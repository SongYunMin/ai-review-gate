import { describe, expect, it } from 'vitest';
import type { ReviewResult } from '../schemas/review-result.schema';
import { resolveReviewExitCode } from '../scripts/review-exit-code';

const makeResult = (overrides: Partial<ReviewResult> = {}): ReviewResult => ({
  summary: '검증 결과',
  overallRisk: 'LOW',
  shouldBlockMerge: false,
  violations: [],
  validationWarnings: [],
  ...overrides,
});

describe('resolveReviewExitCode', () => {
  it('검증 경고가 있어도 유효한 차단 위반은 policy blocked를 우선한다', () => {
    const result = makeResult({
      overallRisk: 'CRITICAL',
      shouldBlockMerge: true,
      validationWarnings: ['알 수 없는 rule ID를 제외했습니다: R-INVENTED-999'],
    });

    expect(resolveReviewExitCode(result, true)).toBe(10);
    expect(resolveReviewExitCode(result, false)).toBe(0);
  });

  it('완전히 검증된 차단 결과는 enforce가 켜졌을 때만 policy blocked를 반환한다', () => {
    const result = makeResult({ shouldBlockMerge: true });

    expect(resolveReviewExitCode(result, true)).toBe(10);
    expect(resolveReviewExitCode(result, false)).toBe(0);
  });

  it('유효한 차단 위반 없이 검증 경고만 있으면 operational error를 반환한다', () => {
    const result = makeResult({
      validationWarnings: ['알 수 없는 rule ID를 제외했습니다: R-INVENTED-999'],
    });

    expect(resolveReviewExitCode(result, true)).toBe(2);
    expect(resolveReviewExitCode(result, false)).toBe(2);
  });
});
