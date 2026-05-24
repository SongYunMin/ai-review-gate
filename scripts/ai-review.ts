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

// 로컬 데모와 CI가 같은 엔트리포인트를 쓰도록 최소한의 CLI 옵션만 파싱합니다.
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
        throw new Error('--diff-file 옵션에는 파일 경로가 필요합니다.');
      }

      options.diffFile = diffFile;
      index += 1;
      continue;
    }

    throw new Error(`알 수 없는 인자입니다: ${arg}`);
  }

  return options;
};

const runGit = (args: string[]): string =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

// 로컬에서는 현재 diff를, CI에서는 PR base/head 차이를 읽어 리뷰 입력으로 사용합니다.
const readDiff = async (options: CliOptions): Promise<string> => {
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

// AGENTS.md와 실제 diff를 한 프롬프트에 묶어 모델이 팀 규칙 기준으로만 판단하게 합니다.
const buildReviewPrompt = (agentsMd: string, diff: string): string => [
  '이 PR diff를 팀 컨벤션 기준으로 리뷰하세요.',
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
  // 발표 중 API key, 네트워크, quota 변수 없이도 같은 리포트 렌더링 경로를 검증합니다.
  const mockPath = path.join('demo', 'mock-review-result.json');
  const rawMock = await readFile(mockPath, 'utf8');
  return ReviewResultSchema.parse(JSON.parse(rawMock));
};

const requestReviewFromModel = async (agentsMd: string, diff: string): Promise<ReviewResult> => {
  // 실제 호출 모드는 Gemini OpenAI-compatible API를 OpenAI SDK로 호출하는 예시입니다.
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY가 없습니다. 실제 리뷰 모드에서는 값을 설정하고, 백업 데모에서는 AI_REVIEW_MOCK=1로 실행하세요.',
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
    throw new Error('모델이 구조화된 리뷰 결과를 반환하지 않았습니다.');
  }

  return ReviewResultSchema.parse(parsedResult);
};

const printSummary = (result: ReviewResult): void => {
  // CI 로그에서 빠르게 상태를 읽을 수 있도록 Markdown과 별도로 한 줄 요약을 남깁니다.
  const counts = severityOrder.map((severity) => {
    const count = result.findings.filter((finding) => finding.severity === severity).length;
    return `${severity}=${count}`;
  });

  console.log(
    [
      `위험도: ${result.riskLevel}`,
      `머지 차단 필요: ${result.shouldBlockMerge ? '예' : '아니오'}`,
      `지적 사항: ${result.findings.length}`,
      counts.join(', '),
    ].join(' | '),
  );
};

const main = async (): Promise<void> => {
  // 전체 흐름: diff 수집 -> AI/목업 리뷰 -> JSON 저장 -> 한국어 Markdown 리포트 렌더링.
  const options = parseArgs(process.argv.slice(2));
  const agentsMd = await readFile('AGENTS.md', 'utf8');
  const diff = await readDiff(options);

  if (!diff.trim()) {
    throw new Error('리뷰할 diff가 없습니다. --diff-file을 전달하거나 로컬 변경을 만들거나 stage 하세요.');
  }

  const result =
    process.env.AI_REVIEW_MOCK === '1'
      ? await readMockReviewResult()
      : await requestReviewFromModel(agentsMd, diff);

  await mkdir(path.dirname(defaultReviewResultPath), { recursive: true });
  await writeFile(defaultReviewResultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeReviewReport(result, defaultReviewReportPath);
  printSummary(result);
  console.log(`저장 완료: ${defaultReviewResultPath}`);
  console.log(`저장 완료: ${defaultReviewReportPath}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
