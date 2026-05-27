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

type GateDecision = 'BLOCKED' | 'WARN' | 'PASS';

type CiCheckResult = {
  check: 'npm run build' | 'npm test';
  exitCode: number;
};

type RenderReviewReportOptions = {
  enforce?: boolean;
  ciContext?: string;
};

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

const summarizeText = (value: string, maxLength = 80): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
};

export const resolveGateDecision = (result: ReviewResult): GateDecision => {
  if (result.shouldBlockMerge) {
    return 'BLOCKED';
  }

  const hasNonBlockingViolation = result.violations.some((violation) => violation.violated);
  return hasNonBlockingViolation ? 'WARN' : 'PASS';
};

const gateDecisionMessage = (decision: GateDecision): string => {
  if (decision === 'BLOCKED') {
    return '이 PR은 AGENTS.md Review Contract 기준으로 merge 차단 대상입니다.';
  }

  if (decision === 'WARN') {
    return '이 PR은 merge 차단 대상은 아니지만 Review Contract violation 검토가 필요합니다.';
  }

  return '이 PR은 AGENTS.md Review Contract 기준으로 차단 위반이 없습니다.';
};

const parseExitCodeForCheck = (ciContext: string, check: CiCheckResult['check']): number | undefined => {
  const headingPattern = new RegExp(`^##\\s+${check.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
  const headingMatch = headingPattern.exec(ciContext);

  if (!headingMatch) {
    return undefined;
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = ciContext.slice(sectionStart);
  const nextHeadingIndex = rest.search(/\n##\s+/);
  const section = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);
  const exitCodeMatch = /Exit code:\s*(-?\d+)/i.exec(section);

  if (!exitCodeMatch) {
    return undefined;
  }

  return Number(exitCodeMatch[1]);
};

// GitHub Actions가 만든 CI context에서 발표에 필요한 build/test exit code만 좁게 추출합니다.
export const parseCiContext = (ciContext?: string): CiCheckResult[] => {
  if (!ciContext?.trim()) {
    return [];
  }

  const checks: CiCheckResult['check'][] = ['npm run build', 'npm test'];
  return checks.flatMap((check) => {
    const exitCode = parseExitCodeForCheck(ciContext, check);
    return exitCode === undefined ? [] : [{ check, exitCode }];
  });
};

// structured violation result를 사람이 읽는 한국어 Markdown 리포트로 변환합니다.
export const renderReviewReport = (result: ReviewResult, options: RenderReviewReportOptions = {}): string => {
  const violatedRules = result.violations.filter((violation) => violation.violated);
  const blockingViolations = violatedRules.filter((violation) => violation.gate === 'error');
  const warningViolations = violatedRules.filter((violation) => violation.gate === 'warning');
  const severityCounts = countBySeverity(violatedRules);
  const gateCounts = countByGate(violatedRules);
  const decision = resolveGateDecision(result);
  const ciChecks = parseCiContext(options.ciContext);
  const lines: string[] = [
    '<!-- ai-review-gate-report -->',
    '',
    '# AI Review Gate 리포트',
    '',
    `## 🚦 Gate Decision: ${decision}`,
    '',
    gateDecisionMessage(decision),
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| Overall risk | ${result.overallRisk} |`,
    `| Enforcement | ${options.enforce ? 'ON' : 'OFF'} |`,
    `| Blocking violations | ${blockingViolations.length} |`,
    `| Warning violations | ${warningViolations.length} |`,
    '| Decision rule | `gate=error && confidence>=MEDIUM` |',
    '',
    '## Blocking Rules',
    '',
    ...(blockingViolations.length > 0
      ? [
          '| Rule | Severity | Confidence | Why blocked |',
          '|---|---|---|---|',
          ...blockingViolations.map(
            (violation) =>
              `| ${escapeTableCell(violation.ruleId)} | ${violation.severity} | ${
                violation.confidence
              } | ${escapeTableCell(summarizeText(violation.problem || violation.evidence))} |`,
          ),
        ]
      : ['차단 규칙 위반은 없습니다.']),
    '',
    '## CI Context',
    '',
    ...(ciChecks.length === 2
      ? [
          '| Check | Exit code |',
          '|---|---:|',
          ...ciChecks.map((check) => `| ${check.check} | ${check.exitCode} |`),
          '',
          '빌드와 테스트 결과가 통과하더라도 Review Contract 위반은 별도의 merge decision으로 처리될 수 있습니다.',
        ]
      : ['CI context attached: no']),
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
    ...violatedRules.map(
      (violation) =>
        `| ${escapeTableCell(violation.ruleId)} | ${violation.severity} | ${violation.gate} | ${violation.confidence} | ${escapeTableCell(
          violation.file,
        )} |`,
    ),
    '',
    '## 상세 위반',
    '',
  ];

  for (const violation of violatedRules) {
    lines.push(
      `### ${violation.ruleId} — ${violation.ruleTitle}`,
      '',
      `- **Contract:** \`AGENTS.md > ${violation.ruleId}\``,
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

  if (violatedRules.length === 0) {
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
  options: RenderReviewReportOptions = {},
): Promise<void> => {
  // CI와 로컬 데모 모두 reports 디렉터리가 없을 수 있으므로 쓰기 전에 보장합니다.
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, renderReviewReport(result, options), 'utf8');
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
