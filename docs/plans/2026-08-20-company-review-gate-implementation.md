# Company AI Review Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** 회사 공통 Review Contract와 프로젝트별 base 계약을 안전하게 합쳐 여러 사내 레포에서 재사용 가능한 PR Review Gate를 만든다.

**Architecture:** 중앙 composite action이 GitHub API로 PR diff와 base 브랜치 계약 문서만 읽고 기존 TypeScript 엔진을 실행한다. reusable workflow가 artifact, PR comment, 정책 차단과 운영 오류를 분리하며, 대상 레포는 immutable ref의 caller workflow만 가진다.

**Tech Stack:** Node.js 22, TypeScript, OpenAI SDK의 Gemini-compatible client, Zod, Vitest, GitHub Actions composite action/reusable workflow

---

### Task 1: 계약 계층화

**Files:**
- Create: `contracts/company-global.md`
- Modify: `scripts/parse-review-contract.ts`
- Test: `tests/parseReviewContract.test.ts`

**Steps:**
1. 여러 계약 문서를 순서대로 병합하고 후순위 같은 rule ID가 앞 규칙을 대체하는 실패 테스트를 작성한다.
2. `npm test -- tests/parseReviewContract.test.ts`로 기존 API에 기능이 없어 실패하는지 확인한다.
3. `mergeReviewContracts`를 최소 구현하고 회사 공통 계약을 추가한다.
4. 대상 테스트와 전체 파서 테스트를 통과시킨다.

### Task 2: 모델 결과의 결정론적 검증

**Files:**
- Create: `scripts/normalize-review-result.ts`
- Modify: `schemas/review-result.schema.ts`
- Modify: `scripts/render-review-report.ts`
- Test: `tests/normalizeReviewResult.test.ts`
- Test: `tests/renderReviewReport.test.ts`

**Steps:**
1. unknown rule ID와 변경되지 않은 파일이 차단 근거에서 제외되는 실패 테스트를 작성한다.
2. 모델의 title, severity, gate, shouldBlockMerge를 신뢰하지 않고 계약 값과 코드 계산으로 정규화하는 실패 테스트를 작성한다.
3. 테스트 실패 이유가 기능 부재임을 확인한다.
4. 최소 정규화 함수와 검증 경고 리포트를 구현한다.
5. 대상 테스트를 통과시킨다.

### Task 3: 안전한 GitHub PR 입력

**Files:**
- Create: `scripts/github-pull-request-input.ts`
- Modify: `scripts/ai-review.ts`
- Test: `tests/githubPullRequestInput.test.ts`
- Test: `tests/aiReviewCli.test.ts`

**Steps:**
1. GitHub API diff와 base SHA contents 조회, missing project contract 무시, size limit의 실패 테스트를 작성한다.
2. 주입 가능한 fetch를 쓰는 wished-for API 테스트가 실패하는지 확인한다.
3. API loader와 `--github-pr` 입력 모드를 최소 구현한다.
4. 공통 계약 다음에 project paths를 병합하고 정규화된 결과만 저장하도록 CLI를 연결한다.
5. policy blocked exit code 10과 operational error exit code 2를 테스트한다.

### Task 4: 공용 Action과 workflow

**Files:**
- Create: `.github/actions/ai-review-gate/action.yml`
- Create: `.github/workflows/reusable-ai-review-gate.yml`
- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/ai-review-gate.yml`
- Create: `examples/caller-workflow.yml`
- Create: `tests/githubActionsContract.test.ts`

**Steps:**
1. `workflow_call`, pinned actions, `$/` self action, head checkout 금지, named secret, 최종 상태 분리를 요구하는 정적 실패 테스트를 작성한다.
2. 실패를 확인한 뒤 composite action과 reusable workflow를 추가한다.
3. 기존 workflow를 base-context caller로 바꾸고 표준 build/test CI를 secret 없는 별도 workflow로 분리한다.
4. 정적 테스트를 통과시킨다.

### Task 5: 프롬프트와 문서

**Files:**
- Modify: `prompts/code-review-system.md`
- Modify: `README.md`
- Modify: `docs/local-test-guide.md`
- Modify: `.codex/project-worklog.md`

**Steps:**
1. diff와 계약 문서를 untrusted data로 취급하고 known rule ID만 평가하도록 시스템 프롬프트를 좁힌다.
2. 공용 caller, organization secret, external data 전송, fork 조건, comment-only rollout을 문서화한다.
3. worklog에 실제 변경과 남은 리스크를 반영한다.

### Task 6: 전체 검증과 리뷰

**Files:**
- Review: all changed files

**Steps:**
1. `npm run build`를 실행한다.
2. `npm test`를 실행한다.
3. mock CLI의 PASS와 enforce BLOCKED 종료 코드를 직접 확인한다.
4. git diff와 status로 사용자 `.gitignore` 변경이 섞이지 않았는지 확인한다.
5. 별도 에이전트로 요구사항 적합성 리뷰 후 코드 품질 리뷰를 수행한다.
6. Critical/Important 지적을 수정하고 전체 검증을 다시 실행한다.
7. 검증 결과를 요약한 뒤 사용자에게 커밋 여부를 묻는다. 커밋은 명시 승인 전 실행하지 않는다.
