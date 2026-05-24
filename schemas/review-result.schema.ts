import { z } from 'zod';

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

export const severityOrder: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
