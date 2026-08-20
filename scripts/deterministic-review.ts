import type { ModelReviewResult } from '../schemas/review-result.schema';
import type { ReviewRule } from './parse-review-contract';
import { isSensitiveFilePath } from './sanitize-review-input';

type ModelViolation = ModelReviewResult['violations'][number];

export const deterministicRuleIds = new Set(['R-SEC-001', 'R-BYPASS-001']);

export const hasBlockingDeterministicViolation = (violations: ModelViolation[]): boolean =>
  violations.some(
    (violation) =>
      violation.gate === 'error' &&
      (violation.confidence === 'MEDIUM' || violation.confidence === 'HIGH'),
  );

type AddedFileDiff = {
  file: string;
  addedLines: string[];
  isNewFile: boolean;
};

const secretAssignmentPattern =
  /(?:^|[^A-Za-z0-9_])["']?(?:api[_-]?key|token|_?auth[_-]?token|secret|password|passwd|private[_-]?key|client[_-]?secret)["']?\s*[:=]\s*(.+)$/i;
const knownTokenPattern =
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,})\b/;
const safeReferencePattern =
  /(?:process\.env|import\.meta\.env|os\.environ|system\.getenv|\$\{\{\s*secrets\.|vault|secretmanager|getsecret)/i;
const placeholderPattern = /(?:placeholder|example|dummy|change-?me|your[-_ ]|test[-_ ])/i;

const parseAddedFileDiffs = (diff: string): AddedFileDiff[] => {
  const files: AddedFileDiff[] = [];
  let current: AddedFileDiff | undefined;

  for (const line of diff.split(/\r?\n/)) {
    const headerMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);

    if (headerMatch) {
      current = { file: headerMatch[2], addedLines: [], isNewFile: false };
      files.push(current);
      continue;
    }

    if (current && (line === '--- /dev/null' || line.startsWith('new file mode '))) {
      current.isNewFile = true;
      continue;
    }

    if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.addedLines.push(line.slice(1));
    }
  }

  return files;
};

const isFixturePath = (filePath: string): boolean =>
  /(?:^|\/)(?:tests?|__tests__|fixtures?|__fixtures__|testdata)(?:\/|$)/i.test(filePath) ||
  /\.(?:fixture|mock)\./i.test(filePath);

const isExamplePath = (filePath: string): boolean => /\.(?:example|sample|template)$/i.test(filePath);

const isExecutableBypassPath = (filePath: string): boolean =>
  /^(?:\.github\/workflows\/|scripts\/)/.test(filePath) ||
  /\.(?:sh|bash|zsh|yml|yaml)$/.test(filePath) ||
  /(?:^|\/)(?:package\.json|Makefile|Justfile)$/.test(filePath);

const hasLiteralSecret = (line: string): boolean => {
  if (/-----BEGIN [^-\n]*PRIVATE KEY-----/i.test(line) || knownTokenPattern.test(line)) {
    return true;
  }

  const bearerMatch = /Bearer\s+([A-Za-z0-9._~+/-]{12,}={0,2})/i.exec(line);

  if (bearerMatch && !placeholderPattern.test(bearerMatch[1])) {
    return true;
  }

  const assignmentMatch = secretAssignmentPattern.exec(line);

  if (!assignmentMatch) {
    return false;
  }

  const rawValue = assignmentMatch[1].trim().replace(/[;,}]+$/, '').trim();
  const quotedValueMatch = /^(['"])(.*)\1$/.exec(rawValue);

  if (
    !quotedValueMatch &&
    (
      /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\([^)]*\))*$/.test(rawValue) ||
      /^(?:await|new)\s|\$\{|\$\(|[()?]|\s(?:\+|\-|\*|\/|\?|\|\||&&)\s/.test(rawValue)
    )
  ) {
    return false;
  }

  const value = quotedValueMatch?.[2] ?? rawValue;
  const hasStrongLiteralShape =
    value.length >= 16 && /[A-Za-z]/.test(value) && (/\d/.test(value) || /[-_+/=:@]/.test(value));

  return (
    hasStrongLiteralShape &&
    !safeReferencePattern.test(value) &&
    !placeholderPattern.test(value) &&
    !value.includes('[AI_REVIEW_REDACTED')
  );
};

const hasExecutableBypassFlag = (line: string): boolean => {
  const trimmed = line.trim();

  if (/^(?:#(?!\!)|\/\/|\/\*|\*|<!--)/.test(trimmed) || /^(?:echo|printf)\b/.test(trimmed)) {
    return false;
  }

  return /\bgit\s+(?:commit|merge|rebase|push)\b.*(?:--no-verify|--no-gpg-sign)/.test(trimmed);
};

const createViolation = (
  rule: ReviewRule,
  file: string,
  category: ModelViolation['category'],
  lineHint: string,
  evidence: string,
  problem: string,
  suggestion: string,
): ModelViolation => ({
  ruleId: rule.ruleId,
  ruleTitle: rule.title,
  category,
  severity: rule.severity,
  gate: rule.gate,
  confidence: 'HIGH',
  violated: true,
  file,
  lineHint,
  evidence,
  problem,
  suggestion,
});

export const evaluateDeterministicViolations = (
  diff: string,
  changedFiles: string[],
  reviewRules: ReviewRule[],
): ModelViolation[] => {
  const changedFileSet = new Set(changedFiles);
  const rulesById = new Map(reviewRules.map((rule) => [rule.ruleId, rule]));
  const securityRule = rulesById.get('R-SEC-001');
  const bypassRule = rulesById.get('R-BYPASS-001');
  const violations: ModelViolation[] = [];
  const seen = new Set<string>();

  for (const fileDiff of parseAddedFileDiffs(diff)) {
    if (!changedFileSet.has(fileDiff.file)) {
      continue;
    }

    const fixturePath = isFixturePath(fileDiff.file);
    const hasSensitivePath =
      fileDiff.isNewFile &&
      isSensitiveFilePath(fileDiff.file) &&
      !fixturePath &&
      !isExamplePath(fileDiff.file);
    const hasSensitiveContent = fileDiff.addedLines.some(hasLiteralSecret);

    if (securityRule && securityRule.gate !== 'off' && (hasSensitivePath || hasSensitiveContent)) {
      const key = `${securityRule.ruleId}\0${fileDiff.file}`;

      if (!seen.has(key)) {
        seen.add(key);
        violations.push(
          createViolation(
            securityRule,
            fileDiff.file,
            'SECURITY',
            '추가된 민감 파일 또는 literal secret',
            '민감 파일 경로 또는 literal secret 추가가 감지되었습니다. 실제 값은 출력하지 않았습니다.',
            '저장소와 외부 AI provider에 비밀값이 노출될 수 있습니다.',
            '민감값을 제거하고 승인된 secret store 또는 환경변수 참조로 교체하세요.',
          ),
        );
      }
    }

    const hasBypassFlag =
      isExecutableBypassPath(fileDiff.file) &&
      fileDiff.addedLines.some(hasExecutableBypassFlag);

    if (bypassRule && bypassRule.gate !== 'off' && hasBypassFlag) {
      const key = `${bypassRule.ruleId}\0${fileDiff.file}`;

      if (!seen.has(key)) {
        seen.add(key);
        violations.push(
          createViolation(
            bypassRule,
            fileDiff.file,
            'TOOLING',
            '추가된 git bypass flag',
            '`--no-verify` 또는 `--no-gpg-sign` 우회 플래그가 추가되었습니다.',
            '필수 hook 또는 signing 검증을 자동으로 우회합니다.',
            '우회 플래그를 제거하고 실패 원인을 수정하세요.',
          ),
        );
      }
    }
  }

  return violations;
};
