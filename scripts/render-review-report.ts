import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type ReviewFinding,
  type ReviewResult,
  ReviewResultSchema,
  severityOrder,
  type Severity,
} from '../schemas/review-result.schema';

export const defaultReviewResultPath = path.join('reports', 'review-result.json');
export const defaultReviewReportPath = path.join('reports', 'review-report.md');

const countBySeverity = (findings: ReviewFinding[]): Record<Severity, number> => {
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  return counts;
};

export const renderReviewReport = (result: ReviewResult): string => {
  const counts = countBySeverity(result.findings);
  const lines: string[] = [
    '# AI Review Gate Report',
    '',
    `**Risk level:** ${result.riskLevel}`,
    `**Should block merge:** ${result.shouldBlockMerge ? 'Yes' : 'No'}`,
    '',
    '## Summary',
    '',
    result.summary,
    '',
    '## Finding Count by Severity',
    '',
    '| Severity | Count |',
    '|---|---:|',
    ...severityOrder.map((severity) => `| ${severity} | ${counts[severity]} |`),
    '',
    '## Findings',
    '',
  ];

  for (const severity of severityOrder) {
    const findings = result.findings.filter((finding) => finding.severity === severity);

    if (findings.length === 0) {
      continue;
    }

    lines.push(`### ${severity}`, '');

    findings.forEach((finding, index) => {
      lines.push(
        `#### ${index + 1}. ${finding.category}`,
        '',
        `- **File:** \`${finding.file}\``,
        `- **Line hint:** ${finding.lineHint}`,
        `- **Problem:** ${finding.problem}`,
        `- **Suggestion:** ${finding.suggestion}`,
        `- **Related rule:** ${finding.relatedRule}`,
        '',
      );
    });
  }

  if (result.findings.length === 0) {
    lines.push('No findings were reported.', '');
  }

  lines.push(
    '---',
    '',
    'This is an advisory review. Humans remain responsible for final approval.',
    '',
  );

  return lines.join('\n');
};

export const writeReviewReport = async (
  result: ReviewResult,
  reportPath = defaultReviewReportPath,
): Promise<void> => {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, renderReviewReport(result), 'utf8');
};

const main = async (): Promise<void> => {
  const rawResult = await readFile(defaultReviewResultPath, 'utf8');
  const result = ReviewResultSchema.parse(JSON.parse(rawResult));
  await writeReviewReport(result);
  console.log(`Rendered ${defaultReviewReportPath}`);
};

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
