export type ReviewGate = 'off' | 'warning' | 'error';
export type ReviewSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReviewRule = {
  ruleId: string;
  title: string;
  severity: ReviewSeverity;
  gate: ReviewGate;
  appliesTo: string[];
  rule: string;
  violationExamples: string[];
  expectedEvidence: string[];
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

const parseRule = (ruleMarkdown: string): ReviewRule => {
  const headerMatch = ruleMarkdown.match(/^###\s+(R-[A-Z]+-\d{3}):\s+(.+)$/m);

  if (!headerMatch) {
    throw new Error('Review Contract 규칙 헤더는 "### R-XXX-000: 제목" 형식이어야 합니다.');
  }

  const [, ruleId, title] = headerMatch;
  const body = ruleMarkdown.slice(headerMatch.index! + headerMatch[0].length).trim();
  const severity = assertReviewSeverity(ruleId, extractSingleLineField(ruleId, body, 'Severity'));
  const gate = assertReviewGate(ruleId, extractSingleLineField(ruleId, body, 'Gate'));
  const rule = extractTextSection(ruleId, body, 'Rule', true);

  return {
    ruleId,
    title: title.trim(),
    severity,
    gate,
    appliesTo: extractListSection(body, 'Applies to'),
    rule,
    violationExamples: extractListSection(body, 'Violation examples'),
    expectedEvidence: extractListSection(body, 'Expected evidence'),
  };
};

export const parseReviewContract = (agentsMd: string): ReviewRule[] => {
  const contractStart = agentsMd.search(/^## Review Contract\s*$/m);

  if (contractStart === -1) {
    throw new Error('AGENTS.md에 "## Review Contract" 섹션이 없습니다.');
  }

  const contractMarkdown = agentsMd.slice(contractStart);
  const ruleHeaderMatches = [...contractMarkdown.matchAll(/^###\s+R-[A-Z]+-\d{3}:.+$/gm)];

  if (ruleHeaderMatches.length === 0) {
    throw new Error('Review Contract에 파싱 가능한 규칙이 없습니다.');
  }

  return ruleHeaderMatches.map((match, index) => {
    const start = match.index!;
    const next = ruleHeaderMatches[index + 1]?.index ?? contractMarkdown.length;
    const ruleMarkdown = contractMarkdown.slice(start, next).replace(/^---\s*$/gm, '').trim();
    return parseRule(ruleMarkdown);
  });
};

export const formatRulesForPrompt = (rules: ReviewRule[]): string =>
  rules
    .map((rule) => {
      const appliesTo = rule.appliesTo.length > 0 ? rule.appliesTo.join(', ') : '(not specified)';
      const violationExamples =
        rule.violationExamples.length > 0 ? rule.violationExamples.join(' / ') : '(not specified)';
      const expectedEvidence =
        rule.expectedEvidence.length > 0 ? rule.expectedEvidence.join(' / ') : '(not specified)';

      return [
        `- ${rule.ruleId}: ${rule.title}`,
        `  Severity: ${rule.severity}`,
        `  Gate: ${rule.gate}`,
        `  Applies to: ${appliesTo}`,
        `  Rule: ${rule.rule.replace(/\s+/g, ' ')}`,
        `  Violation examples: ${violationExamples}`,
        `  Expected evidence: ${expectedEvidence}`,
      ].join('\n');
    })
    .join('\n\n');
