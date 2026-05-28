import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseReviewContract, formatRulesForPrompt } from '../scripts/parse-review-contract';

describe('parseReviewContract', () => {
  it('AGENTS.md의 Review Contract에서 모든 규칙 ID를 파싱한다', () => {
    const agentsMd = readFileSync('AGENTS.md', 'utf8');

    const rules = parseReviewContract(agentsMd);

    expect(rules.map((rule) => rule.ruleId)).toEqual([
      'R-ARCH-001',
      'R-AUTH-001',
      'R-TX-001',
      'R-IDEMP-001',
      'R-ERR-001',
      'R-TEST-001',
    ]);
  });

  it('Severity와 Gate 값을 안정적으로 캡처한다', () => {
    const agentsMd = [
      '## Review Contract',
      '',
      '### R-AUTH-001: Ownership validation',
      '',
      'Severity: CRITICAL',
      'Gate: error',
      'Applies to:',
      '- src/services/**',
      '',
      'Rule:',
      '사용자별 데이터 접근 전에 소유권을 확인해야 합니다.',
    ].join('\n');

    const [rule] = parseReviewContract(agentsMd);

    expect(rule).toMatchObject({
      ruleId: 'R-AUTH-001',
      title: 'Ownership validation',
      severity: 'CRITICAL',
      gate: 'error',
      appliesTo: ['src/services/**'],
    });
  });

  it('지원하지 않는 Severity 값이면 유용한 오류를 던진다', () => {
    const agentsMd = [
      '## Review Contract',
      '',
      '### R-AUTH-001: Ownership validation',
      '',
      'Severity: BLOCKER',
      'Gate: error',
      '',
      'Rule:',
      '소유권을 확인해야 합니다.',
    ].join('\n');

    expect(() => parseReviewContract(agentsMd)).toThrow(/R-AUTH-001.*Severity/i);
  });

  it('Rule 필드가 없으면 유용한 오류를 던진다', () => {
    const agentsMd = [
      '## Review Contract',
      '',
      '### R-AUTH-001: Ownership validation',
      '',
      'Severity: CRITICAL',
      'Gate: error',
    ].join('\n');

    expect(() => parseReviewContract(agentsMd)).toThrow(/R-AUTH-001.*Rule/i);
  });

  it('프롬프트용 포맷에는 규칙 ID가 포함된다', () => {
    const rules = parseReviewContract([
      '## Review Contract',
      '',
      '### R-AUTH-001: Ownership validation',
      '',
      'Severity: CRITICAL',
      'Gate: error',
      'Applies to:',
      '- src/services/**',
      '',
      'Rule:',
      '사용자별 데이터 접근 전에 소유권을 확인해야 합니다.',
    ].join('\n'));

    const formatted = formatRulesForPrompt(rules);

    expect(formatted).toContain('R-AUTH-001');
    expect(formatted).toContain('Severity: CRITICAL');
    expect(formatted).toContain('Gate: error');
  });
});
