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

// 리포트 상단 요약 표에서 severity별 개수를 안정적으로 보여주기 위한 집계입니다.
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

// 구조화된 JSON 리뷰 결과를 사람이 읽는 한국어 Markdown 리포트로 변환합니다.
export const renderReviewReport = (result: ReviewResult): string => {
  const counts = countBySeverity(result.findings);
  const lines: string[] = [
    '# AI Review Gate 리포트',
    '',
    `**위험도:** ${result.riskLevel}`,
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
    ...severityOrder.map((severity) => `| ${severity} | ${counts[severity]} |`),
    '',
    '## 지적 사항',
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
        `- **파일:** \`${finding.file}\``,
        `- **라인 힌트:** ${finding.lineHint}`,
        `- **문제:** ${finding.problem}`,
        `- **제안:** ${finding.suggestion}`,
        `- **관련 규칙:** ${finding.relatedRule}`,
        '',
      );
    });
  }

  if (result.findings.length === 0) {
    lines.push('보고된 지적 사항이 없습니다.', '');
  }

  lines.push(
    '---',
    '',
    '이 리포트는 보조 검토 자료이며, 최종 승인은 사람이 책임집니다.',
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
