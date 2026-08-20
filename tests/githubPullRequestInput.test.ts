import { describe, expect, it } from 'vitest';
import {
  assertDiffWithinLimit,
  loadGitHubPullRequestInput,
} from '../scripts/github-pull-request-input';

const contractMarkdown = [
  '## Review Contract',
  '',
  '### R-PROJECT-001: Project rule',
  '',
  'Severity: HIGH',
  'Gate: warning',
  '',
  'Rule:',
  '프로젝트 규칙입니다.',
].join('\n');

describe('loadGitHubPullRequestInput', () => {
  it('PR diff와 변경 파일을 읽고 계약 문서는 base SHA에서만 가져온다', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      requestedUrls.push(url);
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer github-token');
      expect(new Headers(init?.headers).get('x-github-api-version')).toBe('2026-03-10');

      if (url.endsWith('/repos/company/service/pulls/17')) {
        expect(new Headers(init?.headers).get('accept')).toBe('application/vnd.github.v3.diff');
        return new Response('diff --git a/src/a.ts b/src/a.ts\n+changed');
      }

      if (url.includes('/repos/company/service/pulls/17/files?')) {
        return Response.json([
          { filename: 'src/a.ts' },
          { filename: 'src/new.ts', previous_filename: 'src/old.ts' },
        ]);
      }

      if (url.includes('/repos/company/service/contents/AGENTS.md?ref=base-sha')) {
        return Response.json({
          type: 'file',
          encoding: 'base64',
          content: Buffer.from(contractMarkdown).toString('base64'),
        });
      }

      if (url.includes('/repos/company/service/contents/CLAUDE.md?ref=base-sha')) {
        return new Response('not found', { status: 404 });
      }

      return new Response('unexpected request', { status: 500 });
    };

    const input = await loadGitHubPullRequestInput({
      apiUrl: 'https://api.github.test',
      token: 'github-token',
      repository: 'company/service',
      pullNumber: 17,
      baseSha: 'base-sha',
      contractPaths: ['AGENTS.md', 'CLAUDE.md'],
      maxDiffBytes: 1024,
      fetchImpl,
    });

    expect(input.diff).toContain('+changed');
    expect(input.changedFiles).toEqual(['src/a.ts', 'src/new.ts', 'src/old.ts']);
    expect(input.contracts).toEqual([
      {
        source: 'AGENTS.md',
        markdown: contractMarkdown,
      },
    ]);
    expect(requestedUrls.filter((url) => url.includes('/contents/'))).toEqual([
      'https://api.github.test/repos/company/service/contents/AGENTS.md?ref=base-sha',
      'https://api.github.test/repos/company/service/contents/CLAUDE.md?ref=base-sha',
    ]);
  });

  it('diff 제한을 넘으면 후속 API를 호출하지 않고 운영 오류로 거부한다', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return new Response('가');
    };

    await expect(
      loadGitHubPullRequestInput({
        apiUrl: 'https://api.github.test',
        token: 'github-token',
        repository: 'company/service',
        pullNumber: 17,
        baseSha: 'base-sha',
        contractPaths: ['AGENTS.md'],
        maxDiffBytes: 2,
        fetchImpl,
      }),
    ).rejects.toThrow(/diff.*3 bytes.*2 bytes/i);
    expect(requestedUrls).toHaveLength(1);
  });

  it('상대경로를 벗어나는 계약 경로는 API 호출 전에 거부한다', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return new Response('unexpected request');
    };

    await expect(
      loadGitHubPullRequestInput({
        apiUrl: 'https://api.github.test',
        token: 'github-token',
        repository: 'company/service',
        pullNumber: 17,
        baseSha: 'base-sha',
        contractPaths: ['../AGENTS.md'],
        maxDiffBytes: 1024,
        fetchImpl,
      }),
    ).rejects.toThrow(/계약 경로.*상대 경로/i);
    expect(requestedUrls).toEqual([]);
  });

  it('변경 파일 수 제한을 넘으면 계약 조회 전에 거부한다', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.endsWith('/repos/company/service/pulls/17')) {
        return new Response('small diff');
      }

      return Response.json([{ filename: 'a.ts' }, { filename: 'b.ts' }, { filename: 'c.ts' }]);
    };

    await expect(
      loadGitHubPullRequestInput({
        apiUrl: 'https://api.github.test',
        token: 'github-token',
        repository: 'company/service',
        pullNumber: 17,
        baseSha: 'base-sha',
        contractPaths: ['AGENTS.md'],
        maxDiffBytes: 1024,
        maxChangedFiles: 2,
        fetchImpl,
      }),
    ).rejects.toThrow(/변경 파일.*3.*2/i);
    expect(requestedUrls.some((url) => url.includes('/contents/'))).toBe(false);
  });

  it('rename 이전 경로는 검증 목록에 포함하되 변경 파일 수에는 한 번만 센다', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.endsWith('/repos/company/service/pulls/17')) {
        return new Response('rename diff');
      }

      return Response.json([{ filename: 'src/new.ts', previous_filename: 'src/old.ts' }]);
    };

    const input = await loadGitHubPullRequestInput({
      apiUrl: 'https://api.github.test',
      token: 'github-token',
      repository: 'company/service',
      pullNumber: 17,
      baseSha: 'base-sha',
      contractPaths: [],
      maxDiffBytes: 1024,
      maxChangedFiles: 1,
      fetchImpl,
    });

    expect(input.changedFiles).toEqual(['src/new.ts', 'src/old.ts']);
  });
});

describe('assertDiffWithinLimit', () => {
  it('UTF-8 바이트 기준 최대 크기까지 허용하고 초과하면 거부한다', () => {
    expect(() => assertDiffWithinLimit('가', 3)).not.toThrow();
    expect(() => assertDiffWithinLimit('가', 2)).toThrow(/3 bytes.*2 bytes/i);
  });
});
