import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  parseReviewContract,
  formatRulesForPrompt,
  mergeReviewContracts,
} from '../scripts/parse-review-contract';

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
      '',
      'Expected evidence:',
      '- 누락된 소유권 검증 지점',
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
      '',
      'Expected evidence:',
      '- 누락된 소유권 검증 지점',
    ].join('\n'));

    const formatted = formatRulesForPrompt(rules);

    expect(formatted).toContain('R-AUTH-001');
    expect(formatted).toContain('Severity: CRITICAL');
    expect(formatted).toContain('Gate: error');
  });

  it('후순위 프로젝트 계약이 같은 rule ID의 회사 공통 규칙을 덮어쓴다', () => {
    const globalContract = [
      '## Review Contract',
      '',
      '### R-COMPANY-TEST-001: Tests are required',
      '',
      'Severity: MEDIUM',
      'Gate: warning',
      'Applies to:',
      '- src/**',
      '',
      'Rule:',
      '변경된 동작에는 테스트가 필요합니다.',
      '',
      'Expected evidence:',
      '- 관련 테스트 변경 여부',
      '',
      '### R-COMPANY-SECRET-001: Secrets must not be committed',
      '',
      'Severity: CRITICAL',
      'Gate: error',
      'Applies to:',
      '- **',
      '',
      'Rule:',
      '시크릿 파일을 커밋하면 안 됩니다.',
      '',
      'Expected evidence:',
      '- 민감 파일 경로',
    ].join('\n');
    const projectContract = [
      '## Review Contract',
      '',
      '### R-COMPANY-TEST-001: Project test policy',
      '',
      'Severity: HIGH',
      'Gate: error',
      'Applies to:',
      '- packages/api/**',
      '',
      'Rule:',
      'API 변경에는 통합 테스트가 필요합니다.',
      '',
      'Expected evidence:',
      '- API 통합 테스트 변경 여부',
    ].join('\n');

    const rules = mergeReviewContracts([
      { source: 'company-global.md', markdown: globalContract, required: true },
      { source: 'AGENTS.md', markdown: projectContract },
      { source: 'CLAUDE.md', markdown: '# Team notes without an executable contract' },
    ]);

    expect(rules).toHaveLength(2);
    expect(rules.find((rule) => rule.ruleId === 'R-COMPANY-TEST-001')).toMatchObject({
      title: 'Project test policy',
      severity: 'HIGH',
      gate: 'error',
      appliesTo: ['packages/api/**'],
      source: 'AGENTS.md',
    });
    expect(rules.find((rule) => rule.ruleId === 'R-COMPANY-SECRET-001')).toMatchObject({
      source: 'company-global.md',
    });
  });

  it('회사 공통 계약은 diff에서 검증 가능한 최소 규칙만 제공한다', () => {
    const companyContract = readFileSync('contracts/company-global.md', 'utf8');

    const rules = parseReviewContract(companyContract, 'contracts/company-global.md');

    expect(rules.map((rule) => rule.ruleId)).toEqual([
      'R-SEC-001',
      'R-BYPASS-001',
      'R-VERIFY-001',
      'R-TEST-100',
      'R-MACOS-001',
      'R-SCOPE-001',
      'R-SIMP-001',
      'R-DRY-001',
      'R-SOC-001',
    ]);
    expect(rules.filter((rule) => rule.gate === 'error').map((rule) => rule.ruleId)).toEqual([
      'R-SEC-001',
      'R-BYPASS-001',
    ]);
  });

  it('같은 계약 문서 안의 중복 rule ID는 구성 오류로 거부한다', () => {
    const duplicateContract = [
      '## Review Contract',
      '',
      '### R-SCOPE-001: First scope rule',
      '',
      'Severity: MEDIUM',
      'Gate: warning',
      'Applies to:',
      '- src/**',
      '',
      'Rule:',
      '첫 번째 규칙입니다.',
      '',
      'Expected evidence:',
      '- 첫 번째 변경 파일',
      '',
      '### R-SCOPE-001: Duplicate scope rule',
      '',
      'Severity: HIGH',
      'Gate: error',
      'Applies to:',
      '- src/**',
      '',
      'Rule:',
      '중복된 두 번째 규칙입니다.',
      '',
      'Expected evidence:',
      '- 두 번째 변경 파일',
    ].join('\n');

    expect(() => parseReviewContract(duplicateContract, 'AGENTS.md')).toThrow(/AGENTS\.md.*R-SCOPE-001.*중복/i);
  });

  it('Gate off 규칙은 모델용 resolved contract에서 제외한다', () => {
    const formatted = formatRulesForPrompt([
      {
        ruleId: 'R-SCOPE-001',
        source: 'AGENTS.md',
        title: 'Disabled scope rule',
        severity: 'MEDIUM',
        gate: 'off',
        appliesTo: ['**'],
        rule: '비활성화된 규칙입니다.',
        violationExamples: [],
        expectedEvidence: ['변경 파일'],
      },
    ]);

    expect(formatted).not.toContain('R-SCOPE-001');
  });

  it('Applies to와 Expected evidence가 비어 있으면 구성 오류로 거부한다', () => {
    const withoutAppliesTo = [
      '## Review Contract',
      '',
      '### R-SCOPE-001: Scope rule',
      '',
      'Severity: MEDIUM',
      'Gate: warning',
      '',
      'Rule:',
      '범위를 지켜야 합니다.',
      '',
      'Expected evidence:',
      '- 변경 파일',
    ].join('\n');
    const withoutExpectedEvidence = [
      '## Review Contract',
      '',
      '### R-SCOPE-001: Scope rule',
      '',
      'Severity: MEDIUM',
      'Gate: warning',
      'Applies to:',
      '- **',
      '',
      'Rule:',
      '범위를 지켜야 합니다.',
    ].join('\n');

    expect(() => parseReviewContract(withoutAppliesTo, 'AGENTS.md')).toThrow(/R-SCOPE-001.*Applies to/i);
    expect(() => parseReviewContract(withoutExpectedEvidence, 'AGENTS.md')).toThrow(
      /R-SCOPE-001.*Expected evidence/i,
    );
  });
});
