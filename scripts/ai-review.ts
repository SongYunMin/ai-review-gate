import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  ModelReviewResultSchema,
  type ModelReviewResult,
  type ReviewResult,
  severityOrder,
} from '../schemas/review-result.schema';
import { buildReviewPrompt } from './build-review-prompt';
import {
  evaluateDeterministicViolations,
  hasBlockingDeterministicViolation,
} from './deterministic-review';
import {
  assertDiffWithinLimit,
  assertValidContractPaths,
  loadGitHubPullRequestInput,
} from './github-pull-request-input';
import { normalizeReviewResult } from './normalize-review-result';
import { resolveReviewExitCode } from './review-exit-code';
import {
  mergeReviewContracts,
  type ReviewContractDocument,
  type ReviewRule,
} from './parse-review-contract';
import {
  defaultReviewReportPath,
  defaultReviewResultPath,
  resolveGateDecision,
  writeReviewReport,
} from './render-review-report';

type CliOptions = {
  diffFile?: string;
  ciContextFile?: string;
  ci: boolean;
  githubPr: boolean;
};

type ReviewInput = {
  diff: string;
  changedFiles: string[];
  contractDocuments: ReviewContractDocument[];
};

const defaultMaxDiffBytes = 500_000;
const defaultMaxChangedFiles = 200;
const geminiOpenAiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const operationalErrorExitCode = 2;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { ci: false, githubPr: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--ci') {
      options.ci = true;
      continue;
    }

    if (arg === '--github-pr') {
      options.githubPr = true;
      continue;
    }

    if (arg === '--diff-file') {
      const diffFile = argv[index + 1];

      if (!diffFile) {
        throw new Error('--diff-file 옵션에는 파일 경로가 필요합니다.');
      }

      options.diffFile = diffFile;
      index += 1;
      continue;
    }

    if (arg === '--ci-context-file') {
      const ciContextFile = argv[index + 1];

      if (!ciContextFile) {
        throw new Error('--ci-context-file 옵션에는 파일 경로가 필요합니다.');
      }

      options.ciContextFile = ciContextFile;
      index += 1;
      continue;
    }

    throw new Error(`알 수 없는 인자입니다: ${arg}`);
  }

  if (options.githubPr && (options.diffFile || options.ci)) {
    throw new Error('--github-pr은 --diff-file 또는 --ci와 함께 사용할 수 없습니다.');
  }

  return options;
};

const runGit = (args: string[]): string =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const parsePositiveInteger = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name}은 양의 정수여야 합니다.`);
  }

  return parsed;
};

const parseContractPaths = (value: string | undefined): string[] =>
  (value ?? 'AGENTS.md,CLAUDE.md')
    .split(/[\n,]/)
    .map((contractPath) => contractPath.trim())
    .filter(Boolean);

const readOptionalFile = async (filePath: string): Promise<string | undefined> => {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
};

const resolveToolPath = (relativeOrAbsolutePath: string): string => {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }

  const toolRoot = process.env.AI_REVIEW_TOOL_ROOT ?? process.cwd();
  return path.resolve(toolRoot, relativeOrAbsolutePath);
};

const readGlobalContract = async (): Promise<ReviewContractDocument> => {
  const configuredPath = process.env.AI_REVIEW_GLOBAL_CONTRACT_FILE ?? 'contracts/company-global.md';

  return {
    source: configuredPath,
    markdown: await readFile(resolveToolPath(configuredPath), 'utf8'),
    required: true,
  };
};

export const parseChangedFilesFromDiff = (diff: string): string[] => {
  const changedFiles = new Set<string>();

  for (const line of diff.split(/\r?\n/)) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);

    if (match) {
      changedFiles.add(match[1]);
      changedFiles.add(match[2]);
    }
  }

  return [...changedFiles];
};

const readLocalProjectContracts = async (contractPaths: string[]): Promise<ReviewContractDocument[]> => {
  const documents: ReviewContractDocument[] = [];

  for (const contractPath of contractPaths) {
    const markdown = await readOptionalFile(path.resolve(process.cwd(), contractPath));

    if (markdown !== undefined) {
      documents.push({ source: contractPath, markdown });
    }
  }

  return documents;
};

const readLocalDiff = async (options: CliOptions): Promise<string> => {
  if (options.diffFile) {
    return readFile(options.diffFile, 'utf8');
  }

  if (options.ci) {
    const baseRef = process.env.PR_BASE_SHA ?? process.env.GITHUB_BASE_REF;
    const headRef = process.env.PR_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'HEAD';

    if (!baseRef) {
      throw new Error('CI 모드에는 PR_BASE_SHA 또는 GITHUB_BASE_REF가 필요합니다.');
    }

    return runGit(['diff', `${baseRef}...${headRef}`]);
  }

  const unstagedDiff = runGit(['diff']);
  const stagedDiff = runGit(['diff', '--cached']);
  return [unstagedDiff, stagedDiff].filter(Boolean).join('\n');
};

const readGitHubReviewInput = async (
  contractPaths: string[],
  maxDiffBytes: number,
  maxChangedFiles: number,
): Promise<Omit<ReviewInput, 'contractDocuments'> & { projectContracts: ReviewContractDocument[] }> => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;

  if (!eventPath || !repository || !token) {
    throw new Error('--github-pr에는 GITHUB_EVENT_PATH, GITHUB_REPOSITORY, GITHUB_TOKEN이 필요합니다.');
  }

  const event = JSON.parse(await readFile(eventPath, 'utf8')) as {
    pull_request?: {
      number?: unknown;
      base?: { sha?: unknown };
    };
  };
  const pullNumber = event.pull_request?.number;
  const baseSha = event.pull_request?.base?.sha;

  if (typeof pullNumber !== 'number' || typeof baseSha !== 'string' || !baseSha) {
    throw new Error('GitHub event에 pull_request.number 또는 pull_request.base.sha가 없습니다.');
  }

  const input = await loadGitHubPullRequestInput({
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    token,
    repository,
    pullNumber,
    baseSha,
    contractPaths,
    maxDiffBytes,
    maxChangedFiles,
  });

  return {
    diff: input.diff,
    changedFiles: input.changedFiles,
    projectContracts: input.contracts,
  };
};

const readReviewInput = async (options: CliOptions): Promise<ReviewInput> => {
  const contractPaths = parseContractPaths(process.env.AI_REVIEW_PROJECT_CONTRACT_PATHS);
  assertValidContractPaths(contractPaths);
  const maxDiffBytes = parsePositiveInteger(
    process.env.AI_REVIEW_MAX_DIFF_BYTES,
    defaultMaxDiffBytes,
    'AI_REVIEW_MAX_DIFF_BYTES',
  );
  const maxChangedFiles = parsePositiveInteger(
    process.env.AI_REVIEW_MAX_CHANGED_FILES,
    defaultMaxChangedFiles,
    'AI_REVIEW_MAX_CHANGED_FILES',
  );
  const globalContract = await readGlobalContract();

  if (options.githubPr) {
    const githubInput = await readGitHubReviewInput(contractPaths, maxDiffBytes, maxChangedFiles);
    return {
      diff: githubInput.diff,
      changedFiles: githubInput.changedFiles,
      contractDocuments: [globalContract, ...githubInput.projectContracts],
    };
  }

  const diff = await readLocalDiff(options);
  assertDiffWithinLimit(diff, maxDiffBytes);
  const changedFiles = parseChangedFilesFromDiff(diff);

  if (changedFiles.length > maxChangedFiles) {
    throw new Error(
      `PR 변경 파일 수 ${changedFiles.length}개가 허용 한도 ${maxChangedFiles}개를 초과했습니다.`,
    );
  }

  return {
    diff,
    changedFiles,
    contractDocuments: [globalContract, ...(await readLocalProjectContracts(contractPaths))],
  };
};

const readOptionalCiContext = async (options: CliOptions): Promise<string | undefined> => {
  if (!options.ciContextFile) {
    return undefined;
  }

  return readFile(options.ciContextFile, 'utf8');
};

const readMockReviewResult = async (): Promise<ModelReviewResult> => {
  const rawMock = await readFile(resolveToolPath('demo/mock-review-result.json'), 'utf8');
  return ModelReviewResultSchema.parse(JSON.parse(rawMock));
};

const requestReviewFromModel = async (
  contractDocuments: ReviewContractDocument[],
  reviewRules: ReviewRule[],
  diff: string,
  ciContext?: string,
): Promise<ModelReviewResult> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY가 없습니다. 실제 violation 판정 모드에서는 값을 설정하고, 로컬 검증에서는 AI_REVIEW_MOCK=1을 사용하세요.',
    );
  }

  const model = process.env.GEMINI_MODEL;

  if (!model) {
    throw new Error('GEMINI_MODEL이 없습니다. 회사에서 승인한 모델을 명시하세요.');
  }

  const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: process.env.GEMINI_BASE_URL ?? geminiOpenAiBaseUrl,
  });
  const systemPrompt = await readFile(resolveToolPath('prompts/code-review-system.md'), 'utf8');
  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: buildReviewPrompt(contractDocuments, reviewRules, diff, ciContext),
      },
    ],
    response_format: zodResponseFormat(ModelReviewResultSchema, 'review_result'),
  });
  const parsedResult = completion.choices[0]?.message.parsed;

  if (!parsedResult) {
    throw new Error('모델이 structured violation result를 반환하지 않았습니다.');
  }

  return ModelReviewResultSchema.parse(parsedResult);
};

const printSummary = (result: ReviewResult): void => {
  const counts = severityOrder.map((severity) => {
    const count = result.violations.filter((violation) => violation.severity === severity).length;
    return `${severity}=${count}`;
  });

  console.log(
    [
      `위험도: ${result.overallRisk}`,
      `Gate decision: ${resolveGateDecision(result)}`,
      `structured violation result: ${result.violations.length}`,
      counts.join(', '),
    ].join(' | '),
  );
};

const main = async (): Promise<number> => {
  const options = parseArgs(process.argv.slice(2));
  const reviewInput = await readReviewInput(options);
  const ciContext = await readOptionalCiContext(options);

  if (!reviewInput.diff.trim()) {
    throw new Error('Review Contract violation을 판정할 diff가 없습니다.');
  }

  const reviewRules = mergeReviewContracts(reviewInput.contractDocuments);
  const deterministicViolations = evaluateDeterministicViolations(
    reviewInput.diff,
    reviewInput.changedFiles,
    reviewRules,
  );
  let modelResult: ModelReviewResult;
  const mockMode = process.env.AI_REVIEW_MOCK === '1';

  if (hasBlockingDeterministicViolation(deterministicViolations) && !mockMode) {
    modelResult = ModelReviewResultSchema.parse({
      summary: '결정론적 Review Contract 위반이 감지되었습니다.',
      overallRisk: 'LOW',
      shouldBlockMerge: false,
      violations: deterministicViolations,
    });
  } else {
    const evaluatedResult = mockMode
      ? await readMockReviewResult()
      : await requestReviewFromModel(
          reviewInput.contractDocuments,
          reviewRules,
          reviewInput.diff,
          ciContext,
        );
    modelResult = ModelReviewResultSchema.parse({
      ...evaluatedResult,
      violations: [...deterministicViolations, ...evaluatedResult.violations],
    });
  }
  const result = normalizeReviewResult(
    modelResult,
    reviewRules,
    reviewInput.changedFiles,
    deterministicViolations,
  );

  await mkdir(path.dirname(defaultReviewResultPath), { recursive: true });
  await writeFile(defaultReviewResultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeReviewReport(result, defaultReviewReportPath, {
    enforce: process.env.AI_REVIEW_ENFORCE === '1',
    ciContext,
  });
  printSummary(result);
  console.log(`저장 완료: ${defaultReviewResultPath}`);
  console.log(`저장 완료: ${defaultReviewReportPath}`);
  const exitCode = resolveReviewExitCode(result, process.env.AI_REVIEW_ENFORCE === '1');

  if (exitCode === 2) {
    console.error('AI 응답 일부가 계약 검증을 통과하지 못해 NOT_EVALUATED로 처리합니다.');
  } else if (exitCode === 10) {
    console.error('AI_REVIEW_ENFORCE=1이며 Review Gate decision이 BLOCKED입니다.');
  }

  return exitCode;
};

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = operationalErrorExitCode;
  });
