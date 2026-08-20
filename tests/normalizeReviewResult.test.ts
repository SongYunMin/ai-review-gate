import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeReviewResult } from '../scripts/normalize-review-result';
import { parseReviewContract, type ReviewRule } from '../scripts/parse-review-contract';

const contractRule: ReviewRule = {
  ruleId: 'R-SEC-001',
  source: 'contracts/company-global.md',
  title: 'Sensitive configuration files must not be committed',
  severity: 'CRITICAL',
  gate: 'error',
  appliesTo: ['**/.env'],
  rule: '민감한 설정 파일을 커밋하면 안 됩니다.',
  violationExamples: ['.env 파일을 추가합니다.'],
  expectedEvidence: ['민감 파일 경로'],
};
const fakeGitHubToken = ['github', 'pat', 'abcdefghijklmnopqrstuvwxyz123456'].join('_');

const makeRawViolation = (overrides: Record<string, unknown> = {}) => ({
  ruleId: 'R-SEC-001',
  ruleTitle: '모델이 만든 잘못된 제목',
  category: 'AUTHORIZATION',
  severity: 'LOW',
  gate: 'off',
  confidence: 'HIGH',
  violated: true,
  file: '.env',
  lineHint: '새 파일',
  evidence: '민감 파일이 추가되었습니다.',
  problem: '시크릿 노출 위험이 있습니다.',
  suggestion: '파일을 제거하세요.',
  ...overrides,
});

describe('normalizeReviewResult', () => {
  it('모델의 정책 필드를 계약값으로 덮고 gate 결정을 다시 계산한다', () => {
    const result = normalizeReviewResult(
      {
        summary: '모델 요약',
        overallRisk: 'LOW',
        shouldBlockMerge: false,
        violations: [makeRawViolation()],
      },
      [contractRule],
      ['.env'],
    );

    expect(result).toMatchObject({
      summary: '검증된 Review Contract 위반 1건이 있습니다.',
      overallRisk: 'CRITICAL',
      shouldBlockMerge: true,
      validationWarnings: [],
    });
    expect(result.violations[0]).toMatchObject({
      ruleId: 'R-SEC-001',
      source: 'contracts/company-global.md',
      ruleTitle: contractRule.title,
      severity: 'CRITICAL',
      gate: 'error',
    });
  });

  it('알 수 없는 rule ID와 변경 파일 밖의 지적을 차단 근거에서 제외한다', () => {
    const result = normalizeReviewResult(
      {
        summary: '검증되지 않은 모델 결과',
        overallRisk: 'CRITICAL',
        shouldBlockMerge: true,
        violations: [
          makeRawViolation({ ruleId: 'R-INVENTED-999' }),
          makeRawViolation({ file: 'src/unchanged.ts' }),
        ],
      },
      [contractRule],
      ['src/changed.ts'],
    );

    expect(result.violations).toEqual([]);
    expect(result.summary).toBe('AI 응답 일부가 계약 검증을 통과하지 못해 정책 결과를 확정하지 않았습니다.');
    expect(result.overallRisk).toBe('LOW');
    expect(result.shouldBlockMerge).toBe(false);
    expect(result.validationWarnings).toEqual([
      '알 수 없는 rule ID를 제외했습니다: R-INVENTED-999',
      '변경 파일이 아닌 근거를 제외했습니다: src/unchanged.ts (R-SEC-001)',
    ]);
  });

  it('변경 파일이어도 규칙의 Applies to 범위 밖이면 제외한다', () => {
    const result = normalizeReviewResult(
      {
        summary: '잘못 매핑된 규칙',
        overallRisk: 'CRITICAL',
        shouldBlockMerge: true,
        violations: [makeRawViolation({ file: 'src/config.ts' })],
      },
      [contractRule],
      ['src/config.ts'],
    );

    expect(result.violations).toEqual([]);
    expect(result.validationWarnings).toEqual([
      '규칙 적용 경로 밖의 근거를 제외했습니다: src/config.ts (R-SEC-001)',
    ]);
  });

  it('Gate off로 override된 규칙은 위반과 위험도 계산에서 제외한다', () => {
    const result = normalizeReviewResult(
      {
        summary: '비활성화된 규칙 위반 주장',
        overallRisk: 'CRITICAL',
        shouldBlockMerge: true,
        violations: [makeRawViolation()],
      },
      [{ ...contractRule, gate: 'off' }],
      ['.env'],
    );

    expect(result.violations).toEqual([]);
    expect(result.overallRisk).toBe('LOW');
    expect(result.shouldBlockMerge).toBe(false);
    expect(result.validationWarnings).toEqual([]);
  });

  it('민감 파일 redaction 대상은 R-SEC-001 적용 경로에도 포함한다', () => {
    const companyRules = parseReviewContract(
      readFileSync('contracts/company-global.md', 'utf8'),
      'contracts/company-global.md',
    );

    const result = normalizeReviewResult(
      {
        summary: '민감 파일 두 개가 추가되었습니다.',
        overallRisk: 'CRITICAL',
        shouldBlockMerge: true,
        violations: [
          makeRawViolation({ file: 'certs/server.key' }),
          makeRawViolation({ file: 'config/credential.json' }),
        ],
      },
      companyRules,
      ['certs/server.key', 'config/credential.json'],
    );

    expect(result.violations).toHaveLength(2);
    expect(result.validationWarnings).toEqual([]);
  });

  it('모델이 사람용 필드에 반복한 secret 형태를 저장 전에 다시 가린다', () => {
    const result = normalizeReviewResult(
      {
        summary: '모델 요약',
        overallRisk: 'LOW',
        shouldBlockMerge: false,
        violations: [
          makeRawViolation({
            lineHint: 'token=plain-line-secret',
            evidence: 'clientSecret=plain-evidence-secret',
            problem: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
            suggestion: `${fakeGitHubToken}을 제거하세요.`,
          }),
        ],
      },
      [contractRule],
      ['.env'],
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('plain-line-secret');
    expect(serialized).not.toContain('plain-evidence-secret');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(serialized).toContain('AI_REVIEW_REDACTED');
  });

  it('같은 rule과 파일의 deterministic/model 중복 finding은 하나만 남긴다', () => {
    const duplicate = makeRawViolation();
    const result = normalizeReviewResult(
      {
        summary: '중복 finding',
        overallRisk: 'CRITICAL',
        shouldBlockMerge: true,
        violations: [duplicate, { ...duplicate, evidence: '모델이 반복한 같은 위반입니다.' }],
      },
      [contractRule],
      ['.env'],
    );

    expect(result.violations).toHaveLength(1);
  });

  it('deterministic evidence가 없는 error gate finding은 advisory로 유지한다', () => {
    const result = normalizeReviewResult(
      {
        summary: '모델만 주장한 차단 위반',
        overallRisk: 'CRITICAL',
        shouldBlockMerge: true,
        violations: [makeRawViolation()],
      },
      [contractRule],
      ['.env'],
      [],
    );

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      gate: 'error',
      enforcement: 'advisory',
    });
    expect(result.shouldBlockMerge).toBe(false);
    expect(result.validationWarnings).toEqual([]);
  });
});
