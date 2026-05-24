import { describe, expect, it } from 'vitest';
import { renderReviewReport } from '../scripts/render-review-report';
import type { ReviewResult } from '../schemas/review-result.schema';

describe('renderReviewReport', () => {
  it('한국어 섹션 라벨과 지적 사항 필드를 렌더링한다', () => {
    const result: ReviewResult = {
      summary: '권한 검증이 빠진 변경입니다.',
      riskLevel: 'HIGH',
      shouldBlockMerge: true,
      findings: [
        {
          category: 'AUTHORIZATION',
          severity: 'HIGH',
          file: 'src/controllers/lessonProgressController.ts',
          lineHint: 'completeLesson 내부 처리',
          problem: '컨트롤러에서 수강 여부 확인 없이 완료 처리를 수행합니다.',
          suggestion: '서비스 계층에서 수강 권한을 확인한 뒤 저장하세요.',
          relatedRule: '강의 완료 처리는 수강 등록 여부를 검증해야 합니다.',
        },
      ],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('# AI Review Gate 리포트');
    expect(report).toContain('**위험도:** HIGH');
    expect(report).toContain('**머지 차단 필요:** 예');
    expect(report).toContain('## 요약');
    expect(report).toContain('## 심각도별 지적 사항 수');
    expect(report).toContain('| 심각도 | 개수 |');
    expect(report).toContain('- **파일:** `src/controllers/lessonProgressController.ts`');
    expect(report).toContain('- **라인 힌트:** completeLesson 내부 처리');
    expect(report).toContain('- **문제:** 컨트롤러에서 수강 여부 확인 없이 완료 처리를 수행합니다.');
    expect(report).toContain('- **제안:** 서비스 계층에서 수강 권한을 확인한 뒤 저장하세요.');
    expect(report).toContain('- **관련 규칙:** 강의 완료 처리는 수강 등록 여부를 검증해야 합니다.');
    expect(report).toContain('이 리포트는 보조 검토 자료이며, 최종 승인은 사람이 책임집니다.');
  });

  it('지적 사항이 없을 때 한국어 빈 상태 문구를 렌더링한다', () => {
    const result: ReviewResult = {
      summary: '확인된 지적 사항이 없습니다.',
      riskLevel: 'LOW',
      shouldBlockMerge: false,
      findings: [],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('**머지 차단 필요:** 아니오');
    expect(report).toContain('보고된 지적 사항이 없습니다.');
  });
});
