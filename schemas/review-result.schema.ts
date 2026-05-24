import { z } from 'zod';

// 모델 출력과 mock 결과가 같은 구조를 따르도록 리뷰 카테고리를 고정합니다.
export const FindingCategorySchema = z.enum([
  'AUTHORIZATION',
  'INPUT_VALIDATION',
  'TRANSACTION',
  'IDEMPOTENCY',
  'ERROR_HANDLING',
  'PERFORMANCE',
  'TEST_GAP',
  'MAINTAINABILITY',
]);

export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const ReviewFindingSchema = z.object({
  category: FindingCategorySchema,
  severity: SeveritySchema,
  file: z.string(),
  lineHint: z.string(),
  problem: z.string(),
  suggestion: z.string(),
  relatedRule: z.string(),
});

export const ReviewResultSchema = z.object({
  summary: z.string(),
  riskLevel: SeveritySchema,
  shouldBlockMerge: z.boolean(),
  findings: z.array(ReviewFindingSchema),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;
export type Severity = z.infer<typeof SeveritySchema>;

// 리포트에서 항상 위험도가 높은 항목부터 보이도록 정렬 순서를 명시합니다.
export const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
