import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ai-review CLI', () => {
  it('mock mode에서도 structured violation report를 생성한다', () => {
    execFileSync('npm', ['run', 'ai-review', '--', '--diff-file', 'demo/bad-change.patch'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        AI_REVIEW_MOCK: '1',
        AI_REVIEW_ENFORCE: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

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
});
