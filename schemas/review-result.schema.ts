import { z } from 'zod';

// 모델 출력과 mock 결과가 같은 구조를 따르도록 규칙 위반 카테고리를 고정합니다.
export const ReviewCategorySchema = z.enum([
  'AUTHORIZATION',
  'INPUT_VALIDATION',
  'TRANSACTION',
  'IDEMPOTENCY',
  'ERROR_HANDLING',
  'PERFORMANCE',
  'TEST_GAP',
  'MAINTAINABILITY',
]);

export const ReviewGateSchema = z.enum(['off', 'warning', 'error']);
export const ConfidenceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const ReviewViolationSchema = z.object({
  ruleId: z.string(),
  ruleTitle: z.string(),
  category: ReviewCategorySchema,
  severity: SeveritySchema,
  gate: ReviewGateSchema,
  confidence: ConfidenceSchema,
  violated: z.boolean(),
  file: z.string(),
  lineHint: z.string(),
  evidence: z.string(),
  problem: z.string(),
  suggestion: z.string(),
});

export const ReviewResultSchema = z
  .object({
    summary: z.string(),
    overallRisk: SeveritySchema,
    shouldBlockMerge: z.boolean(),
    violations: z.array(ReviewViolationSchema),
  })
  .superRefine((result, context) => {
    // CI 차단 판단이 모델의 자유 서술에 끌려가지 않도록 구조화 결과와 일치하는지 검증합니다.
    const hasBlockingViolation = result.violations.some(
      (violation) =>
        violation.violated &&
        violation.gate === 'error' &&
        (violation.confidence === 'MEDIUM' || violation.confidence === 'HIGH'),
    );

    if (result.shouldBlockMerge !== hasBlockingViolation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shouldBlockMerge'],
        message:
          'shouldBlockMerge는 gate=error이고 confidence가 MEDIUM 또는 HIGH인 위반이 있을 때만 true여야 합니다.',
      });
    }
  });

export type ReviewResult = z.infer<typeof ReviewResultSchema>;
export type ReviewViolation = z.infer<typeof ReviewViolationSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type ReviewGate = z.infer<typeof ReviewGateSchema>;

// 리포트에서 항상 위험도가 높은 항목부터 보이도록 정렬 순서를 명시합니다.
export const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const gateOrder: ReviewGate[] = ['error', 'warning', 'off'];
