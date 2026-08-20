import type { ReviewContractDocument } from './parse-review-contract';

type GitHubPullRequestInputOptions = {
  apiUrl: string;
  token: string;
  repository: string;
  pullNumber: number;
  baseSha: string;
  contractPaths: string[];
  maxDiffBytes: number;
  maxChangedFiles?: number;
  fetchImpl?: typeof fetch;
};

export type GitHubPullRequestInput = {
  diff: string;
  changedFiles: string[];
  contracts: ReviewContractDocument[];
};

const createHeaders = (token: string, accept: string): Headers =>
  new Headers({
    accept,
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2026-03-10',
  });

const assertOk = (response: Response, resource: string): void => {
  if (!response.ok) {
    throw new Error(`GitHub API에서 ${resource} 조회에 실패했습니다: HTTP ${response.status}`);
  }
};

export const assertDiffWithinLimit = (diff: string, maxDiffBytes: number): void => {
  const diffBytes = Buffer.byteLength(diff, 'utf8');

  if (diffBytes > maxDiffBytes) {
    throw new Error(`PR diff 크기 ${diffBytes} bytes가 허용 한도 ${maxDiffBytes} bytes를 초과했습니다.`);
  }
};

const encodeContentPath = (filePath: string): string =>
  filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export const assertValidContractPaths = (contractPaths: string[]): void => {
  if (contractPaths.length > 10) {
    throw new Error('계약 경로는 최대 10개까지 지정할 수 있습니다.');
  }

  for (const contractPath of contractPaths) {
    const segments = contractPath.split('/');

    if (
      !contractPath ||
      contractPath.startsWith('/') ||
      contractPath.includes('\\') ||
      segments.some((segment) => segment === '..' || segment === '.' || segment === '')
    ) {
      throw new Error(`계약 경로는 저장소 내부의 안전한 상대 경로여야 합니다: ${contractPath}`);
    }
  }
};

export const loadGitHubPullRequestInput = async (
  options: GitHubPullRequestInputOptions,
): Promise<GitHubPullRequestInput> => {
  assertValidContractPaths(options.contractPaths);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiUrl = options.apiUrl.replace(/\/$/, '');
  const pullRequestUrl = `${apiUrl}/repos/${options.repository}/pulls/${options.pullNumber}`;
  const diffResponse = await fetchImpl(pullRequestUrl, {
    headers: createHeaders(options.token, 'application/vnd.github.v3.diff'),
  });
  assertOk(diffResponse, 'PR diff');
  const diff = await diffResponse.text();
  assertDiffWithinLimit(diff, options.maxDiffBytes);

  const changedFiles = new Set<string>();
  const maxChangedFiles = options.maxChangedFiles ?? 200;
  let changedFileCount = 0;

  for (let page = 1; ; page += 1) {
    const filesUrl = `${pullRequestUrl}/files?per_page=100&page=${page}`;
    const filesResponse = await fetchImpl(filesUrl, {
      headers: createHeaders(options.token, 'application/vnd.github+json'),
    });
    assertOk(filesResponse, 'PR 변경 파일');
    const files = (await filesResponse.json()) as unknown;

    if (!Array.isArray(files)) {
      throw new Error('GitHub API의 PR 변경 파일 응답 형식이 올바르지 않습니다.');
    }

    changedFileCount += files.length;

    for (const file of files) {
      if (typeof file === 'object' && file !== null && 'filename' in file && typeof file.filename === 'string') {
        changedFiles.add(file.filename);
      }

      if (
        typeof file === 'object' &&
        file !== null &&
        'previous_filename' in file &&
        typeof file.previous_filename === 'string'
      ) {
        changedFiles.add(file.previous_filename);
      }
    }

    if (changedFileCount > maxChangedFiles) {
      throw new Error(
        `PR 변경 파일 수 ${changedFileCount}개가 허용 한도 ${maxChangedFiles}개를 초과했습니다.`,
      );
    }

    if (files.length < 100) {
      break;
    }
  }

  const contracts: ReviewContractDocument[] = [];

  for (const contractPath of options.contractPaths) {
    const contentsUrl = `${apiUrl}/repos/${options.repository}/contents/${encodeContentPath(
      contractPath,
    )}?ref=${encodeURIComponent(options.baseSha)}`;
    const contentsResponse = await fetchImpl(contentsUrl, {
      headers: createHeaders(options.token, 'application/vnd.github+json'),
    });

    if (contentsResponse.status === 404) {
      continue;
    }

    assertOk(contentsResponse, contractPath);
    const payload = (await contentsResponse.json()) as {
      type?: unknown;
      encoding?: unknown;
      content?: unknown;
    };

    if (payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') {
      throw new Error(`${contractPath}의 GitHub contents 응답 형식이 올바르지 않습니다.`);
    }

    contracts.push({
      source: contractPath,
      markdown: Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8'),
    });
  }

  return {
    diff,
    changedFiles: [...changedFiles],
    contracts,
  };
};
