import { describe, expect, it } from 'vitest';
import { redactSensitiveDiff, scrubSensitiveText } from '../scripts/sanitize-review-input';

const fakeGitHubToken = ['github', 'pat', 'abcdefghijklmnopqrstuvwxyz123456'].join('_');

describe('redactSensitiveDiff', () => {
  it('민감 파일의 실제 diff 내용은 제거하고 파일 경로와 redaction marker만 남긴다', () => {
    const diff = [
      'diff --git a/.env b/.env',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/.env',
      '@@ -0,0 +1,2 @@',
      '+API_KEY=super-secret-value',
      '+DATABASE_PASSWORD=plain-password',
    ].join('\n');

    const redacted = redactSensitiveDiff(diff);

    expect(redacted).toContain('diff --git a/.env b/.env');
    expect(redacted).toContain('[AI_REVIEW_REDACTED_SENSITIVE_FILE_CONTENT]');
    expect(redacted).not.toContain('super-secret-value');
    expect(redacted).not.toContain('plain-password');
  });

  it('일반 소스 파일 diff는 변경하지 않는다', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1 +1 @@',
      '-const enabled = false;',
      '+const enabled = true;',
    ].join('\n');

    expect(redactSensitiveDiff(diff)).toBe(diff);
  });

  it('일반 소스 파일의 secret 대입과 bearer token도 값만 가린다', () => {
    const diff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -0,0 +1,2 @@',
      '+const apiKey = "super-secret-inline";',
      '+const header = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456";',
      '+{"client_secret":"realCompanyCredentialValue123456"}',
    ].join('\n');

    const redacted = redactSensitiveDiff(diff);

    expect(redacted).toContain('apiKey = [AI_REVIEW_REDACTED_SECRET_VALUE]');
    expect(redacted).toContain('Bearer [AI_REVIEW_REDACTED_TOKEN]');
    expect(redacted).not.toContain('super-secret-inline');
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(redacted).not.toContain('realCompanyCredentialValue123456');
  });

  it('npm credential 파일과 private key 계열 파일을 전체 redaction 대상으로 본다', () => {
    const diff = [
      'diff --git a/.npmrc b/.npmrc',
      '--- /dev/null',
      '+++ b/.npmrc',
      '@@ -0,0 +1 @@',
      '+//registry.example/:_authToken=npm-secret-value',
      'diff --git a/certs/client.pem b/certs/client.pem',
      '--- /dev/null',
      '+++ b/certs/client.pem',
      '@@ -0,0 +1 @@',
      '+-----BEGIN PRIVATE KEY-----',
      '+raw-private-key-material',
      '+-----END PRIVATE KEY-----',
    ].join('\n');

    const redacted = redactSensitiveDiff(diff);

    expect(redacted).not.toContain('npm-secret-value');
    expect(redacted).not.toContain('raw-private-key-material');
    expect(redacted.match(/AI_REVIEW_REDACTED_SENSITIVE_FILE_CONTENT/g)).toHaveLength(2);
  });
});

describe('scrubSensitiveText', () => {
  it('모델 출력에 반복된 secret 형태도 안전한 marker로 바꾼다', () => {
    const scrubbed = scrubSensitiveText(
      'evidence: clientSecret=plain-secret Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 '
        + `{"client_secret":"realCompanyCredentialValue123456","token":"${fakeGitHubToken}"}`,
    );

    expect(scrubbed).not.toContain('plain-secret');
    expect(scrubbed).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(scrubbed).not.toContain('realCompanyCredentialValue123456');
    expect(scrubbed).not.toContain(fakeGitHubToken);
    expect(scrubbed).toContain('[AI_REVIEW_REDACTED_SECRET_VALUE]');
    expect(scrubbed).toContain('[AI_REVIEW_REDACTED_TOKEN]');
  });
});
