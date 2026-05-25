import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  gateOrder,
  type ReviewGate,
  type ReviewResult,
  type ReviewViolation,
  ReviewResultSchema,
  severityOrder,
  type Severity,
} from '../schemas/review-result.schema';

export const defaultReviewResultPath = path.join('reports', 'review-result.json');
export const defaultReviewReportPath = path.join('reports', 'review-report.md');

// 리포트 상단 요약 표에서 severity별 개수를 안정적으로 보여주기 위한 집계입니다.
const countBySeverity = (violations: ReviewViolation[]): Record<Severity, number> => {
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const violation of violations) {
    counts[violation.severity] += 1;
  }

  return counts;
};

const countByGate = (violations: ReviewViolation[]): Record<ReviewGate, number> => {
  const counts: Record<ReviewGate, number> = {
    error: 0,
    warning: 0,
    off: 0,
  };

  for (const violation of violations) {
    counts[violation.gate] += 1;
  }

  return counts;
};

const escapeTableCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

// 구조화된 JSON 리뷰 결과를 사람이 읽는 한국어 Markdown 리포트로 변환합니다.
export const renderReviewReport = (result: ReviewResult): string => {
  const severityCounts = countBySeverity(result.violations);
  const gateCounts = countByGate(result.violations);
  const lines: string[] = [
    '<!-- ai-review-gate-report -->',
    '',
    '# AI Review Gate 리포트',
    '',
    `**위험도:** ${result.overallRisk}`,
    `**머지 차단 필요:** ${result.shouldBlockMerge ? '예' : '아니오'}`,
    '',
    '## 요약',
    '',
    result.summary,
    '',
    '## 심각도별 지적 사항 수',
    '',
    '| 심각도 | 개수 |',
    '|---|---:|',
    ...severityOrder.map((severity) => `| ${severity} | ${severityCounts[severity]} |`),
    '',
    '## Gate별 위반 수',
    '',
    '| Gate | 개수 |',
    '|---|---:|',
    ...gateOrder.map((gate) => `| ${gate} | ${gateCounts[gate]} |`),
    '',
    '## 규칙 위반 표',
    '',
    '| Rule | Severity | Gate | Confidence | File |',
    '|---|---|---|---|---|',
    ...result.violations.map(
      (violation) =>
        `| ${escapeTableCell(violation.ruleId)} | ${violation.severity} | ${violation.gate} | ${violation.confidence} | ${escapeTableCell(
          violation.file,
        )} |`,
    ),
    '',
    '## 상세 위반',
    '',
  ];

  for (const violation of result.violations) {
    lines.push(
      `### ${violation.ruleId} — ${violation.ruleTitle}`,
      '',
      `- **Severity:** ${violation.severity}`,
      `- **Gate:** ${violation.gate}`,
      `- **Confidence:** ${violation.confidence}`,
      `- **File:** \`${violation.file}\``,
      `- **Line hint:** ${violation.lineHint}`,
      `- **Evidence:** ${violation.evidence}`,
      `- **Problem:** ${violation.problem}`,
      `- **Suggestion:** ${violation.suggestion}`,
      '',
    );
  }

  if (result.violations.length === 0) {
    lines.push('보고된 규칙 위반이 없습니다.', '');
  }

  lines.push(
    '---',
    '',
    '이 리포트는 자동화된 보조 검토 자료이며, 최종 승인은 사람이 책임집니다.',
    '',
  );

  return lines.join('\n');
};

export const writeReviewReport = async (
  result: ReviewResult,
  reportPath = defaultReviewReportPath,
): Promise<void> => {
  // CI와 로컬 데모 모두 reports 디렉터리가 없을 수 있으므로 쓰기 전에 보장합니다.
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, renderReviewReport(result), 'utf8');
};

const main = async (): Promise<void> => {
  // 단독 실행 시에는 저장된 JSON 결과를 다시 Markdown으로 렌더링합니다.
  const rawResult = await readFile(defaultReviewResultPath, 'utf8');
  const result = ReviewResultSchema.parse(JSON.parse(rawResult));
  await writeReviewReport(result);
  console.log(`리포트 렌더링 완료: ${defaultReviewReportPath}`);
};

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
