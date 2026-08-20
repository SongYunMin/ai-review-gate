import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ai-review CLI', () => {
  it('mock mode에서도 structured violation report를 생성한다', () => {
    const execution = spawnSync('npm', ['run', 'ai-review', '--', '--diff-file', 'demo/bad-change.patch'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AI_REVIEW_MOCK: '1',
        AI_REVIEW_ENFORCE: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(execution.status, execution.stderr).toBe(0);

    const report = readFileSync('reports/review-report.md', 'utf8');
    const result = JSON.parse(readFileSync('reports/review-result.json', 'utf8')) as {
      shouldBlockMerge: boolean;
    };

    expect(result.shouldBlockMerge).toBe(true);
    expect(report).toContain('<!-- ai-review-gate-report -->');
    expect(report).toContain('## 🚦 Gate Decision: BLOCKED');
    expect(report).toContain('## Blocking Rules');
    expect(report).toContain('- **Contract:** `AGENTS.md > R-AUTH-001`');
  });

  it('enforce된 계약 위반은 policy blocked 전용 exit code 10을 반환한다', () => {
    const execution = spawnSync('npm', ['run', 'ai-review', '--', '--diff-file', 'demo/bad-change.patch'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AI_REVIEW_MOCK: '1',
        AI_REVIEW_ENFORCE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(execution.status, execution.stderr).toBe(10);
    expect(execution.stderr).toContain('Review Gate decision이 BLOCKED');
  });

  it('입력 파일 오류는 operational error 전용 exit code 2를 반환한다', () => {
    const execution = spawnSync('npm', ['run', 'ai-review', '--', '--diff-file', 'demo/missing.patch'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AI_REVIEW_MOCK: '1',
        AI_REVIEW_ENFORCE: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(execution.status).toBe(2);
    expect(execution.stderr).toContain('demo/missing.patch');
  });

  it('잘못된 변경 파일 제한 설정은 operational error로 거부한다', () => {
    const execution = spawnSync('npm', ['run', 'ai-review', '--', '--diff-file', 'demo/bad-change.patch'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AI_REVIEW_MOCK: '1',
        AI_REVIEW_ENFORCE: '0',
        AI_REVIEW_MAX_CHANGED_FILES: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(execution.status).toBe(2);
    expect(execution.stderr).toContain('AI_REVIEW_MAX_CHANGED_FILES은 양의 정수');
  });

  it('저장소 밖을 가리키는 로컬 계약 경로는 operational error로 거부한다', () => {
    const execution = spawnSync('npm', ['run', 'ai-review', '--', '--diff-file', 'demo/bad-change.patch'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AI_REVIEW_MOCK: '1',
        AI_REVIEW_ENFORCE: '0',
        AI_REVIEW_PROJECT_CONTRACT_PATHS: '../outside.md',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(execution.status).toBe(2);
    expect(execution.stderr).toContain('계약 경로는 저장소 내부의 안전한 상대 경로');
  });

  it('deterministic error 규칙이 잡히면 provider 설정 없이 즉시 차단한다', () => {
    const tempDirectory = mkdtempSync(path.join(tmpdir(), 'ai-review-gate-'));
    const diffPath = path.join(tempDirectory, 'sensitive.patch');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      AI_REVIEW_MOCK: '0',
      AI_REVIEW_ENFORCE: '1',
    };
    delete env.GEMINI_API_KEY;
    delete env.GEMINI_MODEL;
    writeFileSync(
      diffPath,
      [
        'diff --git a/.env b/.env',
        '--- /dev/null',
        '+++ b/.env',
        '@@ -0,0 +1 @@',
        '+PLACEHOLDER=value',
      ].join('\n'),
    );

    try {
      const execution = spawnSync('npm', ['run', 'ai-review', '--', '--diff-file', diffPath], {
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      expect(execution.status, execution.stderr).toBe(10);
      expect(readFileSync('reports/review-report.md', 'utf8')).toContain('R-SEC-001');
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
