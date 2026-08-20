import { describe, expect, it } from 'vitest';
import { renderReviewReport } from '../scripts/render-review-report';
import type { ReviewResult, ReviewViolation } from '../schemas/review-result.schema';

const makeViolation = (overrides: Partial<ReviewViolation> = {}): ReviewViolation => ({
  ruleId: 'R-AUTH-001',
  source: 'contracts/company-global.md',
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
  ...overrides,
});

const getSection = (report: string, startHeading: string, endHeading: string): string => {
  const start = report.indexOf(startHeading);
  const end = report.indexOf(endHeading, start + startHeading.length);

  if (start === -1 || end === -1) {
    return '';
  }

  return report.slice(start, end);
};

describe('renderReviewReport', () => {
  it('Gate Decision, Blocking Rules, Contract source를 리포트 상단에 렌더링한다', () => {
    const result: ReviewResult = {
      summary: '권한 검증이 빠진 변경입니다.',
      overallRisk: 'CRITICAL',
      shouldBlockMerge: true,
      violations: [
        makeViolation(),
        makeViolation({
          ruleId: 'R-IDEMP-001',
          ruleTitle: 'Retriable write APIs should be idempotent',
          category: 'IDEMPOTENCY',
          severity: 'MEDIUM',
          gate: 'warning',
          confidence: 'MEDIUM',
          evidence: '중복 완료 요청에 대한 기존 상태 확인이 없습니다.',
          problem: '중복 요청에서 course progress가 다시 증가할 수 있습니다.',
          suggestion: '기존 완료 상태를 먼저 확인하세요.',
        }),
      ],
    };

    const report = renderReviewReport(result, {
      enforce: true,
      ciContext: [
        '# CI Context',
        '',
        '## npm run build',
        '',
        '```text',
        'build ok',
        '```',
        '',
        'Exit code: 0',
        '',
        '## npm test',
        '',
        '```text',
        'test ok',
        '```',
        '',
        'Exit code: 0',
      ].join('\n'),
    });
    const blockingRules = getSection(report, '## Blocking Rules', '## CI Context');

    expect(report).toMatch(/^<!-- ai-review-gate-report -->\n\n# AI Review Gate 리포트\n\n## 🚦 Gate Decision: BLOCKED/);
    expect(report).toContain('| Overall risk | CRITICAL |');
    expect(report).toContain('| Enforcement | ON |');
    expect(report).toContain('| Blocking violations | 1 |');
    expect(report).toContain('| Warning violations | 1 |');
    expect(report).toContain('| Decision rule | `gate=error && enforcement=deterministic && confidence>=MEDIUM` |');
    expect(blockingRules).toContain('| R-AUTH-001 | CRITICAL | HIGH | 컨트롤러에서 수강 여부 확인 없이 완료 처리를 수행합니다. |');
    expect(blockingRules).not.toContain('R-IDEMP-001');
    expect(report).toContain('## CI Context');
    expect(report).toContain('| npm run build | 0 |');
    expect(report).toContain('| npm test | 0 |');
    expect(report).toContain('빌드와 테스트 결과가 통과하더라도 Review Contract 위반은 별도의 merge decision으로 처리될 수 있습니다.');
    expect(report).toContain('| Rule | Severity | Gate | Enforcement | Confidence | File |');
    expect(report).toContain('| R-AUTH-001 | CRITICAL | error | deterministic | HIGH | src/controllers/lessonProgressController.ts |');
    expect(report).toContain('### R-AUTH-001 — Ownership or enrollment validation is required');
    expect(report).toContain('- **Contract:** `contracts/company-global.md > R-AUTH-001`');
    expect(report).toContain('- **Gate:** error');
    expect(report).toContain('- **Enforcement:** deterministic');
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

    expect(report).toContain('## 🚦 Gate Decision: PASS');
    expect(report).toContain('| Enforcement | OFF |');
    expect(report).toContain('차단 규칙 위반은 없습니다.');
    expect(report).toContain('CI context attached: no');
    expect(report).toContain('보고된 규칙 위반이 없습니다.');
  });

  it('차단 위반이 없고 warning 위반만 있으면 WARN으로 표시한다', () => {
    const result: ReviewResult = {
      summary: '경고 수준의 멱등성 검토가 필요합니다.',
      overallRisk: 'MEDIUM',
      shouldBlockMerge: false,
      violations: [
        makeViolation({
          ruleId: 'R-IDEMP-001',
          ruleTitle: 'Retriable write APIs should be idempotent',
          category: 'IDEMPOTENCY',
          severity: 'MEDIUM',
          gate: 'warning',
          confidence: 'MEDIUM',
          problem: '중복 요청에서 course progress가 다시 증가할 수 있습니다.',
        }),
      ],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('## 🚦 Gate Decision: WARN');
    expect(report).toContain('| Blocking violations | 0 |');
    expect(report).toContain('| Warning violations | 1 |');
    expect(report).toContain('차단 규칙 위반은 없습니다.');
  });

  it('모델 결과에서 제외한 항목을 검증 경고로 표시한다', () => {
    const result: ReviewResult = {
      summary: '검증 가능한 위반은 없습니다.',
      overallRisk: 'LOW',
      shouldBlockMerge: false,
      violations: [],
      validationWarnings: ['알 수 없는 rule ID를 제외했습니다: R-INVENTED-999'],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('## 🚦 Gate Decision: NOT_EVALUATED');
    expect(report).toContain('## AI 응답 검증 경고');
    expect(report).toContain('- 알 수 없는 rule ID를 제외했습니다: R-INVENTED-999');
  });

  it('LOW confidence error gate는 차단이 아니라 non-blocking violation으로 집계한다', () => {
    const result: ReviewResult = {
      summary: '근거가 약한 error gate 후보입니다.',
      overallRisk: 'HIGH',
      shouldBlockMerge: false,
      violations: [
        makeViolation({
          severity: 'HIGH',
          gate: 'error',
          confidence: 'LOW',
        }),
      ],
    };

    const report = renderReviewReport(result);
    const blockingRules = getSection(report, '## Blocking Rules', '## CI Context');

    expect(report).toContain('## 🚦 Gate Decision: WARN');
    expect(report).toContain('| Blocking violations | 0 |');
    expect(report).toContain('| Warning violations | 1 |');
    expect(blockingRules).not.toContain('R-AUTH-001');
  });

  it('검증 경고가 있어도 유효한 차단 위반의 BLOCKED decision을 유지한다', () => {
    const result: ReviewResult = {
      summary: '유효한 차단 위반이 있습니다.',
      overallRisk: 'CRITICAL',
      shouldBlockMerge: true,
      violations: [makeViolation()],
      validationWarnings: ['알 수 없는 rule ID를 제외했습니다: R-INVENTED-999'],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('## 🚦 Gate Decision: BLOCKED');
    expect(report).toContain('## AI 응답 검증 경고');
  });

  it('AI-only error gate는 advisory로 표시하고 blocking 집계에서 제외한다', () => {
    const result: ReviewResult = {
      summary: '사람이 확인할 error finding입니다.',
      overallRisk: 'CRITICAL',
      shouldBlockMerge: false,
      violations: [makeViolation({ enforcement: 'advisory' })],
    };

    const report = renderReviewReport(result);

    expect(report).toContain('## 🚦 Gate Decision: WARN');
    expect(report).toContain('| Blocking violations | 0 |');
    expect(report).toContain('- **Enforcement:** advisory');
  });
});
