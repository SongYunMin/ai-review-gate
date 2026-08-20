import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  evaluateDeterministicViolations,
  hasBlockingDeterministicViolation,
} from '../scripts/deterministic-review';
import { parseReviewContract } from '../scripts/parse-review-contract';

const companyRules = parseReviewContract(
  readFileSync('contracts/company-global.md', 'utf8'),
  'contracts/company-global.md',
);
const fakeGitHubToken = ['github', 'pat', 'abcdefghijklmnopqrstuvwxyz123456'].join('_');

describe('evaluateDeterministicViolations', () => {
  it('민감 파일은 내용을 노출하지 않고 R-SEC-001로 차단한다', () => {
    const diff = [
      'diff --git a/.env b/.env',
      '--- /dev/null',
      '+++ b/.env',
      '@@ -0,0 +1 @@',
      '+API_KEY=super-secret-value',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['.env'], companyRules);
    const serialized = JSON.stringify(violations);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      ruleId: 'R-SEC-001',
      category: 'SECURITY',
      confidence: 'HIGH',
      file: '.env',
    });
    expect(serialized).not.toContain('super-secret-value');
  });

  it('일반 소스에 추가된 명백한 literal secret도 R-SEC-001로 차단한다', () => {
    const diff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -0,0 +1 @@',
      '+const clientSecret = "literal-secret-value";',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['src/config.ts'], companyRules);

    expect(violations.map((violation) => violation.ruleId)).toEqual(['R-SEC-001']);
    expect(JSON.stringify(violations)).not.toContain('literal-secret-value');
  });

  it('git hook와 signing bypass flag는 R-BYPASS-001로 차단한다', () => {
    const diff = [
      'diff --git a/scripts/release.sh b/scripts/release.sh',
      '--- a/scripts/release.sh',
      '+++ b/scripts/release.sh',
      '@@ -1 +1 @@',
      '+git commit --no-verify --no-gpg-sign -m release',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['scripts/release.sh'], companyRules);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      ruleId: 'R-BYPASS-001',
      category: 'TOOLING',
      confidence: 'HIGH',
      file: 'scripts/release.sh',
    });
  });

  it('환경 변수 참조와 example placeholder는 secret literal로 오인하지 않는다', () => {
    const diff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -0,0 +1 @@',
      '+const clientSecret = process.env.CLIENT_SECRET;',
      '+const clientSecret = config.clientSecret;',
      '+const token = await oauthClient.getToken();',
      '+const password = await hash(input);',
      '+const clientSecret = new SecretProvider();',
      '+const token = "veryLongIdentifierName";',
      'diff --git a/.env.example b/.env.example',
      '--- a/.env.example',
      '+++ b/.env.example',
      '@@ -0,0 +1 @@',
      '+API_KEY=your-api-key-here',
      'diff --git a/tests/config.fixture.ts b/tests/config.fixture.ts',
      '--- /dev/null',
      '+++ b/tests/config.fixture.ts',
      '@@ -0,0 +1 @@',
      '+const clientSecret = "placeholder-fixture-value";',
    ].join('\n');

    const violations = evaluateDeterministicViolations(
      diff,
      ['src/config.ts', '.env.example', 'tests/config.fixture.ts'],
      companyRules,
    );

    expect(violations).toEqual([]);
  });

  it('문서에서 금지 예시로 설명한 bypass flag는 deterministic 차단하지 않는다', () => {
    const diff = [
      'diff --git a/docs/security.md b/docs/security.md',
      '--- a/docs/security.md',
      '+++ b/docs/security.md',
      '@@ -0,0 +1 @@',
      '+검증 실패를 `git commit --no-verify`로 우회하지 마세요.',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['docs/security.md'], companyRules);

    expect(violations).toEqual([]);
  });

  it('example 파일도 실제처럼 보이는 secret literal은 차단한다', () => {
    const diff = [
      'diff --git a/.env.example b/.env.example',
      '--- a/.env.example',
      '+++ b/.env.example',
      '@@ -0,0 +1 @@',
      '+API_KEY=actual-secret-material',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['.env.example'], companyRules);

    expect(violations.map((violation) => violation.ruleId)).toEqual(['R-SEC-001']);
  });

  it('fixture 경로도 실제 token 형태가 있으면 차단한다', () => {
    const diff = [
      'diff --git a/tests/fixtures/auth.json b/tests/fixtures/auth.json',
      '--- a/tests/fixtures/auth.json',
      '+++ b/tests/fixtures/auth.json',
      '@@ -0,0 +1 @@',
      `+{"token":"${fakeGitHubToken}"}`,
    ].join('\n');

    const violations = evaluateDeterministicViolations(
      diff,
      ['tests/fixtures/auth.json'],
      companyRules,
    );

    expect(violations.map((violation) => violation.ruleId)).toEqual(['R-SEC-001']);
  });

  it('일반 JSON 파일의 quoted secret key와 literal value도 차단한다', () => {
    const diff = [
      'diff --git a/config/auth.json b/config/auth.json',
      '--- a/config/auth.json',
      '+++ b/config/auth.json',
      '@@ -0,0 +1 @@',
      '+{"client_secret":"realCompanyCredentialValue123456"}',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['config/auth.json'], companyRules);

    expect(violations.map((violation) => violation.ruleId)).toEqual(['R-SEC-001']);
    expect(JSON.stringify(violations)).not.toContain('realCompanyCredentialValue123456');
  });

  it('warning으로 override된 deterministic finding은 provider 생략 조건이 아니다', () => {
    const rules = companyRules.map((rule) =>
      rule.ruleId === 'R-SEC-001' ? { ...rule, gate: 'warning' as const } : rule,
    );
    const diff = [
      'diff --git a/.env b/.env',
      '--- /dev/null',
      '+++ b/.env',
      '@@ -0,0 +1 @@',
      '+PLACEHOLDER=value',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['.env'], rules);

    expect(violations).toHaveLength(1);
    expect(hasBlockingDeterministicViolation(violations)).toBe(false);
  });

  it('민감 파일 삭제는 secret 커밋으로 차단하지 않는다', () => {
    const diff = [
      'diff --git a/.env b/.env',
      'deleted file mode 100644',
      '--- a/.env',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-API_KEY=removed-secret-value',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['.env'], companyRules);

    expect(violations).toEqual([]);
  });

  it('일반 식별자 문자열은 secret literal로 차단하지 않는다', () => {
    const diff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -0,0 +1 @@',
      '+const token = "identifier";',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['src/config.ts'], companyRules);

    expect(violations).toEqual([]);
  });

  it('실행 파일의 주석에 적힌 bypass 금지 문구는 차단하지 않는다', () => {
    const diff = [
      'diff --git a/scripts/release.sh b/scripts/release.sh',
      '--- a/scripts/release.sh',
      '+++ b/scripts/release.sh',
      '@@ -0,0 +1 @@',
      '+# Never use git commit --no-verify',
    ].join('\n');

    const violations = evaluateDeterministicViolations(diff, ['scripts/release.sh'], companyRules);

    expect(violations).toEqual([]);
  });
});
