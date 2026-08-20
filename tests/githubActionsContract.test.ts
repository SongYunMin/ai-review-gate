import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (filePath: string): string => readFileSync(filePath, 'utf8');

const reusableWorkflowPath = '.github/workflows/reusable-ai-review-gate.yml';
const callerWorkflowPath = '.github/workflows/ai-review-gate.yml';
const ciWorkflowPath = '.github/workflows/ci.yml';
const actionPath = '.github/actions/ai-review-gate/action.yml';

describe('GitHub Actions 공용 Review Gate 계약', () => {
  it('reusable workflow는 명시적인 입력과 named secret으로 중앙 action을 호출한다', () => {
    const workflow = read(reusableWorkflowPath);

    expect(workflow).toContain('workflow_call:');
    expect(workflow).toContain('contract_paths:');
    expect(workflow).toContain('max_diff_bytes:');
    expect(workflow).toContain('max_changed_files:');
    expect(workflow).toContain('fail_on_tool_error:');
    expect(workflow).toContain('ai_api_key:');
    expect(workflow).toContain('uses: $/.github/actions/ai-review-gate');
    expect(workflow).toContain('decision:');
    expect(workflow).toContain('failure_kind:');
    expect(workflow).toContain('id: final_status');
    expect(workflow).toContain('decision: ${{ steps.final_status.outputs.decision }}');
    expect(workflow).toContain('failure_kind: ${{ steps.final_status.outputs.failure_kind }}');
    expect(workflow).toContain('timeout-minutes: 10');
    expect(workflow).toContain("[ \"$ENFORCE\" = 'true' ] || [ \"$FAIL_ON_TOOL_ERROR\" = 'true' ]");
  });

  it('secret을 쓰는 리뷰 경로는 PR head를 checkout하거나 대상 npm script를 실행하지 않는다', () => {
    const reviewAutomation = [read(reusableWorkflowPath), read(callerWorkflowPath), read(actionPath)].join('\n');

    expect(reviewAutomation).not.toMatch(/actions\/checkout@/);
    expect(reviewAutomation).not.toMatch(/\bgit\s+(?:checkout|fetch)\b/);
    expect(reviewAutomation).not.toMatch(/npm\s+run\s+(?:build|test|ai-review)/);
    expect(reviewAutomation).not.toContain('refs/pull/');
    expect(reviewAutomation).not.toContain('base_url:');
    expect(reviewAutomation).not.toContain('GEMINI_BASE_URL');
  });

  it('composite action은 중앙 action 경로에만 설치하고 정책과 운영 상태를 출력한다', () => {
    const action = read(actionPath);

    expect(action).toContain('using: composite');
    expect(action).toContain('github.action_path');
    expect(action).toContain('--ignore-scripts');
    expect(action).toContain('--github-pr');
    expect(action).toContain('decision:');
    expect(action).toContain('failure_kind:');
    expect(action).toContain('review_exit_code:');
  });

  it('외부 action은 mutable tag가 아니라 full commit SHA로 고정한다', () => {
    const files = [read(reusableWorkflowPath), read(ciWorkflowPath), read(actionPath)];
    const remoteUses = files.flatMap((contents) =>
      [...contents.matchAll(/uses:\s+([\w.-]+\/[\w.-]+)@([^\s#]+)/g)].map((match) => match[2]),
    );

    expect(remoteUses.length).toBeGreaterThan(0);
    expect(remoteUses.every((ref) => /^[0-9a-f]{40}$/.test(ref))).toBe(true);
  });

  it('기존 repo caller는 base context에서 reusable workflow만 호출한다', () => {
    const caller = read(callerWorkflowPath);

    expect(caller).toContain('pull_request_target:');
    expect(caller).toContain('uses: $/.github/workflows/reusable-ai-review-gate.yml');
    expect(caller).toContain('ai_api_key: ${{ secrets.GEMINI_API_KEY }}');
    expect(caller).not.toContain('secrets: inherit');
  });

  it('일반 build와 test는 secret 없는 별도 CI workflow에서 실행한다', () => {
    const ci = read(ciWorkflowPath);

    expect(ci).toContain('pull_request:');
    expect(ci).toContain('npm ci');
    expect(ci).toContain('npm run build');
    expect(ci).toContain('npm test');
    expect(ci).not.toMatch(/secrets\./);
    expect(ci).not.toContain('GEMINI_API_KEY');
  });
});
