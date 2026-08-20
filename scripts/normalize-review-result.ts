import {
  ModelReviewResultSchema,
  type ModelReviewResult,
  ReviewResultSchema,
  severityOrder,
  type ReviewResult,
  type ReviewViolation,
} from '../schemas/review-result.schema';
import type { ReviewRule } from './parse-review-contract';
import { scrubSensitiveText } from './sanitize-review-input';

const normalizeFilePath = (filePath: string): string => filePath.replace(/^\.\//, '');

const escapeRegExpCharacter = (character: string): string =>
  /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;

const globToRegExp = (pattern: string): RegExp => {
  let expression = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character !== '*') {
      expression += character === '?' ? '[^/]' : escapeRegExpCharacter(character);
      continue;
    }

    if (pattern[index + 1] !== '*') {
      expression += '[^/]*';
      continue;
    }

    if (pattern[index + 2] === '/') {
      expression += '(?:.*/)?';
      index += 2;
      continue;
    }

    expression += '.*';
    index += 1;
  }

  return new RegExp(`${expression}$`);
};

const matchesAppliesTo = (filePath: string, patterns: string[]): boolean =>
  patterns.length === 0 || patterns.some((pattern) => globToRegExp(pattern).test(filePath));

export const normalizeReviewResult = (
  rawResult: unknown,
  reviewRules: ReviewRule[],
  changedFiles: string[],
  deterministicViolations?: ModelReviewResult['violations'],
): ReviewResult => {
  const modelResult = ModelReviewResultSchema.parse(rawResult);
  const rulesById = new Map(reviewRules.map((rule) => [rule.ruleId, rule]));
  const changedFileSet = new Set(changedFiles.map(normalizeFilePath));
  const validationWarnings: string[] = [];
  const violations: ReviewViolation[] = [];
  const seenViolationKeys = new Set<string>();
  const deterministicViolationKeys = deterministicViolations
    ? new Set(
        deterministicViolations.map(
          (violation) => `${violation.ruleId}\0${normalizeFilePath(violation.file)}`,
        ),
      )
    : undefined;

  for (const violation of modelResult.violations) {
    if (!violation.violated) {
      continue;
    }

    const rule = rulesById.get(violation.ruleId);

    if (!rule) {
      validationWarnings.push(`알 수 없는 rule ID를 제외했습니다: ${violation.ruleId}`);
      continue;
    }

    if (rule.gate === 'off') {
      continue;
    }

    if (!changedFileSet.has(normalizeFilePath(violation.file))) {
      validationWarnings.push(`변경 파일이 아닌 근거를 제외했습니다: ${violation.file} (${violation.ruleId})`);
      continue;
    }

    if (!matchesAppliesTo(normalizeFilePath(violation.file), rule.appliesTo)) {
      validationWarnings.push(`규칙 적용 경로 밖의 근거를 제외했습니다: ${violation.file} (${violation.ruleId})`);
      continue;
    }

    const violationKey = `${violation.ruleId}\0${normalizeFilePath(violation.file)}`;

    if (seenViolationKeys.has(violationKey)) {
      continue;
    }

    seenViolationKeys.add(violationKey);

    violations.push({
      ...violation,
      source: rule.source,
      ruleTitle: rule.title,
      severity: rule.severity,
      gate: rule.gate,
      enforcement:
        rule.gate === 'error' &&
        (deterministicViolationKeys === undefined || deterministicViolationKeys.has(violationKey))
          ? 'deterministic'
          : 'advisory',
      lineHint: scrubSensitiveText(violation.lineHint),
      evidence: scrubSensitiveText(violation.evidence),
      problem: scrubSensitiveText(violation.problem),
      suggestion: scrubSensitiveText(violation.suggestion),
    });
  }

  const overallRisk = severityOrder.find((severity) =>
    violations.some((violation) => violation.severity === severity),
  ) ?? 'LOW';
  const shouldBlockMerge = violations.some(
    (violation) =>
      violation.gate === 'error' &&
      violation.enforcement === 'deterministic' &&
      (violation.confidence === 'MEDIUM' || violation.confidence === 'HIGH'),
  );
  const summary =
    validationWarnings.length > 0
      ? 'AI 응답 일부가 계약 검증을 통과하지 못해 정책 결과를 확정하지 않았습니다.'
      : violations.length > 0
        ? `검증된 Review Contract 위반 ${violations.length}건이 있습니다.`
        : '검증된 Review Contract 위반이 없습니다.';

  return ReviewResultSchema.parse({
    summary,
    overallRisk,
    shouldBlockMerge,
    violations,
    validationWarnings,
  });
};
