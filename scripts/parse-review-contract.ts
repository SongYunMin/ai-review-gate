export type ReviewGate = 'off' | 'warning' | 'error';
export type ReviewSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReviewRule = {
  ruleId: string;
  source: string;
  title: string;
  severity: ReviewSeverity;
  gate: ReviewGate;
  appliesTo: string[];
  rule: string;
  violationExamples: string[];
  expectedEvidence: string[];
};

export type ReviewContractDocument = {
  source: string;
  markdown: string;
  required?: boolean;
};

const severityValues: ReviewSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const gateValues: ReviewGate[] = ['off', 'warning', 'error'];
const sectionLabels = ['Severity:', 'Gate:', 'Applies to:', 'Rule:', 'Violation examples:', 'Expected evidence:'];

const isSectionLabel = (line: string): boolean => sectionLabels.some((label) => line.startsWith(label));

const assertReviewSeverity = (ruleId: string, value: string): ReviewSeverity => {
  if (!severityValues.includes(value as ReviewSeverity)) {
    throw new Error(`${ruleId} 규칙의 Severity 값이 유효하지 않습니다: ${value}`);
  }

  return value as ReviewSeverity;
};

const assertReviewGate = (ruleId: string, value: string): ReviewGate => {
  if (!gateValues.includes(value as ReviewGate)) {
    throw new Error(`${ruleId} 규칙의 Gate 값이 유효하지 않습니다: ${value}`);
  }

  return value as ReviewGate;
};

const extractSingleLineField = (ruleId: string, body: string, label: 'Severity' | 'Gate'): string => {
  const match = body.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'));

  if (!match?.[1]?.trim()) {
    throw new Error(`${ruleId} 규칙에 ${label} 필드가 없습니다.`);
  }

  return match[1].trim();
};

const extractSectionBlock = (body: string, label: string): string[] => {
  const lines = body.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `${label}:`);

  if (startIndex === -1) {
    return [];
  }

  const collected: string[] = [];

  // 단순 파서를 유지하기 위해 다음 알려진 라벨을 만날 때까지만 현재 섹션으로 취급합니다.
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (isSectionLabel(trimmed)) {
      break;
    }

    collected.push(lines[index]);
  }

  return collected;
};

const extractTextSection = (ruleId: string, body: string, label: string, required: boolean): string => {
  const text = extractSectionBlock(body, label)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (required && !text) {
    throw new Error(`${ruleId} 규칙에 ${label} 필드가 없습니다.`);
  }

  return text;
};

const extractListSection = (body: string, label: string): string[] =>
  extractSectionBlock(body, label)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

const ruleHeaderPattern = 'R-[A-Z]+(?:-[A-Z]+)*-\\d{3}';

const parseRule = (ruleMarkdown: string, source: string): ReviewRule => {
  const headerMatch = ruleMarkdown.match(new RegExp(`^###\\s+(${ruleHeaderPattern}):\\s+(.+)$`, 'm'));

  if (!headerMatch) {
    throw new Error('Review Contract 규칙 헤더는 "### R-XXX[-YYY]-000: 제목" 형식이어야 합니다.');
  }

  const [, ruleId, title] = headerMatch;
  const body = ruleMarkdown.slice(headerMatch.index! + headerMatch[0].length).trim();
  const severity = assertReviewSeverity(ruleId, extractSingleLineField(ruleId, body, 'Severity'));
  const gate = assertReviewGate(ruleId, extractSingleLineField(ruleId, body, 'Gate'));
  const rule = extractTextSection(ruleId, body, 'Rule', true);
  const appliesTo = extractListSection(body, 'Applies to');
  const expectedEvidence = extractListSection(body, 'Expected evidence');

  if (appliesTo.length === 0) {
    throw new Error(`${ruleId} 규칙에 Applies to 항목이 없습니다.`);
  }

  if (expectedEvidence.length === 0) {
    throw new Error(`${ruleId} 규칙에 Expected evidence 항목이 없습니다.`);
  }

  return {
    ruleId,
    source,
    title: title.trim(),
    severity,
    gate,
    appliesTo,
    rule,
    violationExamples: extractListSection(body, 'Violation examples'),
    expectedEvidence,
  };
};

export const parseReviewContract = (markdown: string, source = 'AGENTS.md'): ReviewRule[] => {
  const contractStart = markdown.search(/^## Review Contract\s*$/m);

  if (contractStart === -1) {
    throw new Error(`${source}에 "## Review Contract" 섹션이 없습니다.`);
  }

  const contractMarkdown = markdown.slice(contractStart);
  const ruleHeaderMatches = [
    ...contractMarkdown.matchAll(new RegExp(`^###\\s+${ruleHeaderPattern}:.+$`, 'gm')),
  ];

  if (ruleHeaderMatches.length === 0) {
    throw new Error('Review Contract에 파싱 가능한 규칙이 없습니다.');
  }

  const rules = ruleHeaderMatches.map((match, index) => {
    const start = match.index!;
    const next = ruleHeaderMatches[index + 1]?.index ?? contractMarkdown.length;
    const ruleMarkdown = contractMarkdown.slice(start, next).replace(/^---\s*$/gm, '').trim();
    return parseRule(ruleMarkdown, source);
  });

  const seenRuleIds = new Set<string>();

  for (const rule of rules) {
    if (seenRuleIds.has(rule.ruleId)) {
      throw new Error(`${source}에 ${rule.ruleId} 규칙이 중복되어 있습니다.`);
    }

    seenRuleIds.add(rule.ruleId);
  }

  return rules;
};

export const mergeReviewContracts = (documents: ReviewContractDocument[]): ReviewRule[] => {
  const rulesById = new Map<string, ReviewRule>();

  for (const document of documents) {
    if (!/^## Review Contract\s*$/m.test(document.markdown)) {
      if (document.required) {
        throw new Error(`${document.source}에 "## Review Contract" 섹션이 없습니다.`);
      }

      continue;
    }

    for (const rule of parseReviewContract(document.markdown, document.source)) {
      rulesById.set(rule.ruleId, rule);
    }
  }

  if (rulesById.size === 0) {
    throw new Error('Review Contract에 파싱 가능한 규칙이 없습니다.');
  }

  return [...rulesById.values()];
};

export const formatRulesForPrompt = (rules: ReviewRule[]): string =>
  rules
    .filter((rule) => rule.gate !== 'off')
    .map((rule) => {
      const appliesTo = rule.appliesTo.length > 0 ? rule.appliesTo.join(', ') : '(not specified)';
      const violationExamples =
        rule.violationExamples.length > 0 ? rule.violationExamples.join(' / ') : '(not specified)';
      const expectedEvidence =
        rule.expectedEvidence.length > 0 ? rule.expectedEvidence.join(' / ') : '(not specified)';

      return [
        `- ${rule.ruleId}: ${rule.title}`,
        `  Source: ${rule.source}`,
        `  Severity: ${rule.severity}`,
        `  Gate: ${rule.gate}`,
        `  Applies to: ${appliesTo}`,
        `  Rule: ${rule.rule.replace(/\s+/g, ' ')}`,
        `  Violation examples: ${violationExamples}`,
        `  Expected evidence: ${expectedEvidence}`,
      ].join('\n');
    })
    .join('\n\n');
