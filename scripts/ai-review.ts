import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ReviewResultSchema, type ReviewResult, severityOrder } from '../schemas/review-result.schema';
import { defaultReviewReportPath, defaultReviewResultPath, writeReviewReport } from './render-review-report';

type CliOptions = {
  diffFile?: string;
  ci: boolean;
};

const defaultModel = 'gemini-3-flash-preview';
const geminiOpenAiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { ci: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--ci') {
      options.ci = true;
      continue;
    }

    if (arg === '--diff-file') {
      const diffFile = argv[index + 1];

      if (!diffFile) {
        throw new Error('--diff-file requires a file path.');
      }

      options.diffFile = diffFile;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const runGit = (args: string[]): string =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const readDiff = async (options: CliOptions): Promise<string> => {
  if (options.diffFile) {
    return readFile(options.diffFile, 'utf8');
  }

  if (options.ci) {
    const baseRef = process.env.PR_BASE_SHA ?? process.env.GITHUB_BASE_REF;
    const headRef = process.env.PR_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'HEAD';

    if (!baseRef) {
      throw new Error('CI mode requires PR_BASE_SHA or GITHUB_BASE_REF.');
    }

    return runGit(['diff', `${baseRef}...${headRef}`]);
  }

  const unstagedDiff = runGit(['diff']);
  const stagedDiff = runGit(['diff', '--cached']);
  return [unstagedDiff, stagedDiff].filter(Boolean).join('\n');
};

const buildReviewPrompt = (agentsMd: string, diff: string): string => [
  'Review this PR diff against the team conventions.',
  '',
  '## AGENTS.md',
  '',
  agentsMd,
  '',
  '## Pull Request Diff',
  '',
  '```diff',
  diff,
  '```',
].join('\n');

const readMockReviewResult = async (): Promise<ReviewResult> => {
  const mockPath = path.join('demo', 'mock-review-result.json');
  const rawMock = await readFile(mockPath, 'utf8');
  return ReviewResultSchema.parse(JSON.parse(rawMock));
};

const requestReviewFromModel = async (agentsMd: string, diff: string): Promise<ReviewResult> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is missing. Set it for real review mode, or run with AI_REVIEW_MOCK=1.',
    );
  }

  const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: geminiOpenAiBaseUrl,
  });
  const systemPrompt = await readFile(path.join('prompts', 'code-review-system.md'), 'utf8');
  const model = process.env.GEMINI_MODEL ?? defaultModel;

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildReviewPrompt(agentsMd, diff) },
    ],
    // Gemini OpenAI 호환 API에서도 Zod 기반 JSON Schema 출력을 강제합니다.
    response_format: zodResponseFormat(ReviewResultSchema, 'review_result'),
  });

  const parsedResult = completion.choices[0]?.message.parsed;

  if (!parsedResult) {
    throw new Error('The model returned no structured review result.');
  }

  return ReviewResultSchema.parse(parsedResult);
};

const printSummary = (result: ReviewResult): void => {
  const counts = severityOrder.map((severity) => {
    const count = result.findings.filter((finding) => finding.severity === severity).length;
    return `${severity}=${count}`;
  });

  console.log(
    [
      `Risk: ${result.riskLevel}`,
      `Block merge: ${result.shouldBlockMerge ? 'yes' : 'no'}`,
      `Findings: ${result.findings.length}`,
      counts.join(', '),
    ].join(' | '),
  );
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const agentsMd = await readFile('AGENTS.md', 'utf8');
  const diff = await readDiff(options);

  if (!diff.trim()) {
    throw new Error('No diff found. Pass --diff-file or create/stage a local change.');
  }

  const result =
    process.env.AI_REVIEW_MOCK === '1'
      ? await readMockReviewResult()
      : await requestReviewFromModel(agentsMd, diff);

  await mkdir(path.dirname(defaultReviewResultPath), { recursive: true });
  await writeFile(defaultReviewResultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeReviewReport(result, defaultReviewReportPath);
  printSummary(result);
  console.log(`Wrote ${defaultReviewResultPath}`);
  console.log(`Wrote ${defaultReviewReportPath}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
