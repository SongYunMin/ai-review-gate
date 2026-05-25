import { describe, expect, it } from 'vitest';
import { renderReviewReport } from '../scripts/render-review-report';
import type { ReviewResult } from '../schemas/review-result.schema';

describe('renderReviewReport', () => {
  it('규칙 위반 리포트의 핵심 표와 상세 필드를 렌더링한다', () => {
    const result: ReviewResult = {
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

    const report = renderReviewReport(result);

    expect(report).toContain('<!-- ai-review-gate-report -->');
    expect(report).toContain('# AI Review Gate 리포트');
    expect(report).toContain('**위험도:** CRITICAL');
    expect(report).toContain('**머지 차단 필요:** 예');
    expect(report).toContain('| Rule | Severity | Gate | Confidence | File |');
    expect(report).toContain('| R-AUTH-001 | CRITICAL | error | HIGH | src/controllers/lessonProgressController.ts |');
    expect(report).toContain('### R-AUTH-001 — Ownership or enrollment validation is required');
    expect(report).toContain('- **Gate:** error');
    expect(report).toContain('- **Confidence:** HIGH');
    expect(report).toContain('- **File:** `src/controllers/lessonProgressController.ts`');
    expect(report).toContain('- **Line hint:** completeLesson 내부 처리');
    expect(report).toContain('- **Evidence:** lessonId만으로 완료 처리하며 수강 등록 확인이 없습니다.');
    expect(report).toContain('- **Problem:** 컨트롤러에서 수강 여부 확인 없이 완료 처리를 수행합니다.');
    expect(report).toContain('- **Suggestion:** 서비스 계층에서 수강 권한을 확인한 뒤 저장하세요.');
    expect(report).toContain('이 리포트는 자동화된 보조 검토 자료이며, 최종 승인은 사람이 책임집니다.');
  });

  it('위반 사항이 없을 때 한국어 빈 상태 문구를 렌더링한다', () => {
    const result: ReviewResult = {
      summary: '확인된 위반 사항이 없습니다.',
      overallRisk: 'LOW',
      shouldBlockMerge: false,
      violations: [],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('**머지 차단 필요:** 아니오');
    expect(report).toContain('보고된 규칙 위반이 없습니다.');
  });
});
