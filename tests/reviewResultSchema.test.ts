import { describe, expect, it } from 'vitest';
import { ReviewResultSchema, type ReviewResult } from '../schemas/review-result.schema';

const blockingResult: ReviewResult = {
  summary: '권한 검증이 빠진 변경입니다.',
  overallRisk: 'CRITICAL',
  shouldBlockMerge: true,
  violations: [
    {
      ruleId: 'R-AUTH-001',
      ruleTitle: 'Ownership or enrollment validation is required',
      category: 'AUTHORIZATION',
      severity: 'CRITICAL',
      gate: 'error',
      confidence: 'HIGH',
      violated: true,
      file: 'src/controllers/lessonProgressController.ts',
      lineHint: 'completeLesson 내부 처리',
      evidence: 'lessonId만으로 완료 처리하며 수강 등록 확인이 없습니다.',
      problem: '컨트롤러에서 수강 여부 확인 없이 완료 처리를 수행합니다.',
      suggestion: '서비스 계층에서 수강 권한을 확인한 뒤 저장하세요.',
    },
  ],
};

describe('ReviewResultSchema', () => {
  it('gate=error이고 confidence가 MEDIUM 이상인 위반만 shouldBlockMerge=true로 허용한다', () => {
    expect(ReviewResultSchema.parse(blockingResult).shouldBlockMerge).toBe(true);

    expect(() =>
      ReviewResultSchema.parse({
        ...blockingResult,
        shouldBlockMerge: false,
      }),
    ).toThrow(/shouldBlockMerge/);
  });

  it('LOW confidence 차단 후보는 기존 검증 규칙대로 shouldBlockMerge=false를 요구한다', () => {
    const lowConfidenceResult: ReviewResult = {
      ...blockingResult,
      shouldBlockMerge: false,
      violations: [
        {
          ...blockingResult.violations[0],
          confidence: 'LOW',
        },
      ],
    };

    expect(ReviewResultSchema.parse(lowConfidenceResult).shouldBlockMerge).toBe(false);
  });

  it('overallRisk는 실제 위반 중 가장 높은 severity와 일치해야 한다', () => {
    expect(() =>
      ReviewResultSchema.parse({
        ...blockingResult,
        overallRisk: 'LOW',
      }),
    ).toThrow(/overallRisk/);

    expect(
      ReviewResultSchema.parse({
        summary: '위반이 없습니다.',
        overallRisk: 'LOW',
        shouldBlockMerge: false,
        violations: [],
      }).overallRisk,
    ).toBe('LOW');
  });

  it('AI-only error finding은 advisory로 보존하되 shouldBlockMerge=false를 요구한다', () => {
    const advisoryResult = {
      ...blockingResult,
      shouldBlockMerge: false,
      violations: [
        {
          ...blockingResult.violations[0],
          enforcement: 'advisory',
        },
      ],
    };

    expect(ReviewResultSchema.parse(advisoryResult).shouldBlockMerge).toBe(false);
  });
});
