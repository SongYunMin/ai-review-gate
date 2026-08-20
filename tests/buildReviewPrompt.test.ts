import { describe, expect, it } from 'vitest';
import { buildReviewPrompt } from '../scripts/build-review-prompt';
import type { ReviewRule } from '../scripts/parse-review-contract';

const rule: ReviewRule = {
  ruleId: 'R-SEC-001',
  source: 'contracts/company-global.md',
  title: 'Sensitive configuration files must not be committed',
  severity: 'CRITICAL',
  gate: 'error',
  appliesTo: ['**'],
  rule: '시크릿을 커밋하면 안 됩니다.',
  violationExamples: [],
  expectedEvidence: ['민감값을 제외한 파일 경로'],
};

describe('buildReviewPrompt', () => {
  it('contract, diff, CI context의 secret 형태를 모두 scrub한다', () => {
    const prompt = buildReviewPrompt(
      [
        {
          source: 'AGENTS.md',
          markdown: '## Notes\nclientSecret=contract-secret-material',
        },
      ],
      [{ ...rule, rule: 'clientSecret=contract-rule-secret-material' }],
      [
        'diff --git a/src/config.ts b/src/config.ts',
        '--- a/src/config.ts',
        '+++ b/src/config.ts',
        '@@ -0,0 +1 @@',
        '+const apiKey = "diff-secret-material";',
      ].join('\n'),
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    );

    expect(prompt).not.toContain('contract-secret-material');
    expect(prompt).not.toContain('diff-secret-material');
    expect(prompt).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(prompt).not.toContain('contract-rule-secret-material');
    expect(prompt).toContain('AI_REVIEW_REDACTED');
    expect(prompt).toContain('Parsed Resolved Review Contract');
  });
});
