# Vibe Coding에서 Verify Coding으로: AGENTS.md 기반 AI Review Gate

## 1. 프로젝트 한 줄 요약

AI 코딩 도구가 만든 PR diff를 **AGENTS.md에 정의된 팀 컨벤션** 기준으로 리뷰하고, 결과를 **Structured Outputs(JSON)** 로 받은 뒤 **Markdown PR 코멘트**로 렌더링하는 데모 프로젝트입니다.

```text
로컬 개발자
  └─ npm run ai-review
      └─ 내 diff를 AGENTS.md 기준으로 사전 점검

GitHub PR
  └─ GitHub Actions pull_request 이벤트
      └─ PR diff + AGENTS.md 기반 AI Review Gate 실행
          └─ review-result.json 생성
              └─ review-report.md 렌더링
                  └─ PR comment 작성
```

---

## 2. 발표 주제

## Vibe Coding에서 Verify Coding으로: AGENTS.md 기반 AI Review Gate 만들기

### 부제

> PR이 올라오면 GitHub Actions가 팀 컨벤션을 읽고 AI 코드리뷰를 수행한다

### 핵심 메시지

AI가 코드를 더 많이, 더 빠르게 만드는 시대에는 **코드 작성 속도**보다 **검증 루프의 품질**이 중요해집니다.

이 프로젝트는 다음 메시지를 보여줍니다.

1. AI가 만든 코드는 그럴듯하지만 팀 컨벤션을 자주 놓친다.
2. `AGENTS.md`를 팀 리뷰 규칙의 단일 소스로 사용할 수 있다.
3. 같은 리뷰 엔진을 로컬과 GitHub Actions에서 재사용할 수 있다.
4. 최종 결과는 Markdown이지만, 중간 결과는 Structured Outputs 기반 JSON이어야 자동화가 가능하다.
5. 이 시스템은 범용 자동 PR 리뷰 도구를 대체하는 것이 아니라, 팀 컨벤션을 실행 가능한 CI 단계로 바꾸는 구조다.

---

## 3. 왜 이 프로젝트인가?

### 문제

AI 코딩 도구는 코드를 빠르게 생성하지만 다음과 같은 문제는 여전히 사람이 검증해야 합니다.

- 인증/인가 누락
- 트랜잭션 경계 누락
- 멱등성(idempotency) 누락
- 컨트롤러/서비스/리포지토리 역할 분리 위반
- 내부 에러 메시지 노출
- 실패 케이스 테스트 부족
- 팀 컨벤션과 다른 구현

### 해결 아이디어

```text
PR diff
  + AGENTS.md 팀 컨벤션
  + AI review prompt
  + Structured Outputs schema
  ↓
AI Review Gate
  ↓
review-result.json
  ↓
review-report.md
  ↓
PR comment
```

---

## 4. 자동 PR 코드리뷰 시스템과의 차이

| 구분 | 일반 자동 PR 코드리뷰 도구 | AI Review Gate |
|---|---|---|
| 목적 | 범용 코드 리뷰 코멘트 제공 | 팀 컨벤션을 실행 가능한 게이트로 변환 |
| 실행 위치 | 주로 PR 이후 | 로컬 + PR 둘 다 |
| 규칙 소스 | 도구별 설정 또는 내부 로직 | `AGENTS.md`를 명시적으로 읽음 |
| 출력 | 자연어 리뷰 중심 | JSON 결과 + Markdown 렌더링 |
| 제어권 | 외부 도구 동작 방식에 의존 | 팀이 schema, severity, fail 조건 제어 |
| 확장성 | 도구가 제공하는 범위 | PR comment, CI fail, Slack, dashboard 확장 가능 |
| 핵심 메시지 | AI가 리뷰해준다 | 팀 리뷰 기준을 반복 실행한다 |

### 발표용 한 문장

> 범용 리뷰 도구는 리뷰를 “받는 것”에 가깝고, AI Review Gate는 팀 컨벤션을 “실행하는 것”에 가깝다.

---

## 5. AGENTS.md는 반드시 연결한다

이 프로젝트에서 `AGENTS.md`는 optional이 아닙니다. 핵심입니다.

`AGENTS.md`는 다음 역할을 합니다.

1. 팀 컨벤션의 단일 소스
2. AI Review Gate가 읽는 리뷰 규칙 파일
3. 로컬과 CI가 공유하는 기준
4. 리뷰 결과의 근거(`relatedRule`)로 연결되는 규칙 원본

### 예시 AGENTS.md

```md
# AGENTS.md

## Project overview

This is a Node.js TypeScript REST API backend for an edtech service.

## Backend conventions

- Controllers should be thin.
- Business logic must live in service classes.
- Repositories should not be called directly from controllers.
- User-specific data access must verify ownership or enrollment.
- Write operations that update multiple tables must use transactions.
- APIs that can be retried must be idempotent when possible.
- Do not expose internal error messages to clients.

## Review rules

When reviewing backend changes, check:

1. Authorization and ownership validation
2. Input validation
3. Transaction boundaries
4. Idempotency
5. Error masking
6. Test coverage for failure cases
7. Performance impact
```

---

## 6. Structured Outputs가 필요한 이유

최종적으로 사람이 보는 결과는 Markdown이어도 됩니다.

하지만 모델에게 바로 Markdown을 쓰게 하는 것보다, 먼저 JSON을 받고 그 JSON을 Markdown으로 렌더링하는 구조가 훨씬 안정적입니다.

```text
AI가 바로 Markdown 작성
  → 사람이 읽기에는 좋음
  → 프로그램이 severity, category, fail 조건을 안정적으로 처리하기 어려움

AI가 JSON 작성
  → 우리 코드가 Markdown으로 변환
  → CI fail 조건, severity 정렬, rule 연결, artifact 저장 가능
```

### 필요한 자동화 판단

- `CRITICAL` finding이 있으면 CI를 실패시킬까?
- `TEST_GAP`은 warning으로만 둘까?
- 같은 파일의 finding을 묶을까?
- `relatedRule`을 통해 AGENTS.md의 어떤 규칙을 위반했는지 보여줄까?
- JSON artifact를 저장해서 추후 dashboard로 확장할까?

이런 처리는 Markdown보다 JSON이 적합합니다.

### 핵심 문장

> Structured Outputs는 사람이 보는 최종 형식이 아니라, 자동화 파이프라인이 신뢰할 수 있는 중간 결과물이다.

---

## 7. 데모 도메인

GraphQL은 사용하지 않습니다.

데모는 가장 보편적인 REST API로 구성합니다.

## 수강 완료 처리 REST API

```http
POST /api/lessons/:lessonId/complete
```

### 의도적으로 심을 문제

1. Authorization 누락
    - 로그인 사용자가 해당 강의를 수강 중인지 확인하지 않음
2. Idempotency 누락
    - 이미 완료된 강의를 다시 완료 처리할 수 있음
3. Transaction 누락
    - `lesson_progress` insert와 `course_progress` update가 분리됨
4. Error handling 문제
    - 내부 에러 메시지를 그대로 응답
5. Maintainability 문제
    - Controller가 repository를 직접 호출함
6. Test gap
    - 성공 케이스만 테스트
    - 권한 없음, 중복 요청, 트랜잭션 실패 케이스 없음

### 문제가 있는 코드 예시

```ts
export async function completeLesson(req: Request, res: Response) {
  const userId = req.user.id;
  const lessonId = req.params.lessonId;

  const progress = await lessonProgressRepository.create({
    userId,
    lessonId,
    completedAt: new Date(),
  });

  await courseProgressRepository.incrementCompletedLessonCount({
    userId,
    lessonId,
  });

  res.json({
    ok: true,
    progress,
  });
}
```

AI Review Gate가 잡아야 할 내용:

- `lessonId`가 현재 사용자의 수강 가능한 강의인지 검증하지 않음
- 중복 완료 요청 시 중복 insert 가능
- 두 write operation이 transaction으로 묶이지 않음
- controller가 repository를 직접 호출함
- 실패 케이스 테스트가 부족함

---

## 8. Structured Output Schema 예시

```ts
import { z } from "zod";

export const ReviewResultSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  shouldBlockMerge: z.boolean(),
  findings: z.array(
    z.object({
      category: z.enum([
        "AUTHORIZATION",
        "INPUT_VALIDATION",
        "TRANSACTION",
        "IDEMPOTENCY",
        "ERROR_HANDLING",
        "PERFORMANCE",
        "TEST_GAP",
        "MAINTAINABILITY",
      ]),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      file: z.string(),
      lineHint: z.string(),
      problem: z.string(),
      suggestion: z.string(),
      relatedRule: z.string(),
    })
  ),
});
```

`relatedRule`이 중요합니다.

이 필드를 통해 리뷰 결과가 단순히 모델의 일반적인 의견이 아니라, `AGENTS.md`의 어떤 팀 규칙에 근거한 것인지 보여줄 수 있습니다.

---

## 9. GitHub Actions 설계

### 목표

PR이 열리거나 업데이트될 때 자동으로 AI Review Gate를 실행합니다.

### 이벤트

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

### workflow 개요

```yaml
name: AI Review Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  ai-review:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Run AI Review Gate
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          BASE_REF: ${{ github.base_ref }}
          HEAD_REF: ${{ github.head_ref }}
        run: npm run ai-review:ci

      - name: Comment review report on PR
        if: always()
        env:
          GH_TOKEN: ${{ github.token }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: |
          gh pr comment "$PR_NUMBER" --body-file reports/review-report.md
```

### 보안 주의사항

- `pull_request_target`은 사용하지 않는 방향으로 시작합니다.
- 사내 private repo 기준으로 먼저 적용합니다.
- 외부 fork PR이 있는 공개 repo에서는 secret 노출과 untrusted code 실행을 별도로 설계해야 합니다.
- 초기 버전에서는 PR comment만 남기고 merge block은 하지 않는 것이 좋습니다.
- 단계적으로 `CRITICAL`만 block → 특정 category block으로 확장합니다.

---

## 10. 구현 범위

### 반드시 구현

- REST API 예제 코드
- 의도적으로 문제가 있는 diff 또는 patch 파일
- `AGENTS.md`
- `scripts/ai-review.ts`
- Structured Output schema
- Markdown report renderer
- `reports/review-result.json` 생성
- `reports/review-report.md` 생성
- GitHub Actions workflow
- README 데모 가이드

### 있으면 좋은 것

- `--diff-file` 옵션
- `AI_REVIEW_MOCK=1` 백업 모드
- `shouldBlockMerge` 기준을 env로 조정
- `demo/bad-change.patch` 제공
- 발표 당일 API 장애 대비 mock 결과 제공

### 하지 않을 것

- GraphQL 사용
- GitHub App 구현
- 실제 라인별 review comment 구현
- 자동 수정 PR 생성
- 자동 merge block을 기본값으로 강제
- 사내 레포와 직접 연동

---

## 11. 데모 흐름

### 1단계. AGENTS.md 확인

```bash
cat AGENTS.md
```

보여줄 규칙:

- Controllers should be thin.
- Business logic must live in service classes.
- User-specific data access must verify ownership or enrollment.
- Write operations that update multiple tables must use transactions.
- APIs that can be retried must be idempotent when possible.

### 2단계. 문제가 있는 REST API diff 확인

```bash
git diff origin/main...HEAD
```

또는 데모 안정성을 위해:

```bash
cat demo/bad-change.patch
```

### 3단계. 로컬 AI Review Gate 실행

```bash
npm run ai-review
```

또는 백업 모드:

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

### 4단계. JSON 결과 확인

```bash
cat reports/review-result.json
```

### 5단계. Markdown 리포트 확인

```bash
cat reports/review-report.md
```

### 6단계. GitHub Actions 결과 확인

- PR 생성
- AI Review Gate workflow 실행
- PR comment 생성
- Markdown report 확인

---

## 12. 발표 중 예상 질문과 답변

### Q. 이미 Copilot Review나 CodeRabbit 같은 도구가 있는데 왜 이걸 만들죠?

A. 이 프로젝트는 범용 리뷰 도구를 대체하려는 것이 아닙니다. 핵심은 `AGENTS.md`에 있는 팀 컨벤션을 로컬과 CI에서 같은 기준으로 반복 실행하는 것입니다. 범용 도구가 “리뷰를 해주는 서비스”라면, AI Review Gate는 “팀 리뷰 기준을 실행하는 파이프라인”입니다.

### Q. 최종 결과가 Markdown이면 Structured Outputs가 꼭 필요한가요?

A. 사람이 보는 최종 결과는 Markdown이 맞습니다. 하지만 CI는 severity, category, block 여부, relatedRule 같은 구조화된 값을 처리해야 합니다. 그래서 AI 출력은 JSON으로 받고, 우리 코드가 Markdown으로 렌더링하는 구조가 더 안정적입니다.

### Q. AGENTS.md가 너무 부정확하면 어떻게 하나요?

A. 초반에는 짧고 명확한 규칙만 넣는 것이 좋습니다. 리뷰 결과를 보면서 반복적으로 잘 잡는 규칙은 유지하고, false positive를 만드는 규칙은 수정합니다.

### Q. AI가 틀린 리뷰를 하면요?

A. 초기에는 merge block으로 쓰지 않고 comment-only로 시작합니다. 이후 신뢰도가 높은 category만 warning 또는 block으로 승격합니다.

---

# 13. Codex 요청 프롬프트

아래 프롬프트를 Codex에 그대로 붙여넣으면 됩니다.

```text
You are implementing a demo project for an internal 30-minute technical seminar.

Project title:
Vibe Coding에서 Verify Coding으로: AGENTS.md 기반 AI Review Gate 만들기

Goal:
Build a small but realistic demo repository that shows how a team can run an AI Review Gate locally and in GitHub Actions. The Review Gate must read AGENTS.md as the team convention source, review a PR diff against those conventions, get a structured JSON review result, render a Markdown report, and comment that report on a PR through GitHub Actions.

Important context:
- This is for a backend engineering seminar.
- Do NOT use GraphQL.
- Use a simple REST API demo instead.
- The core demo domain is an edtech lesson completion API:
  POST /api/lessons/:lessonId/complete
- The demo should intentionally include review-worthy issues such as missing authorization, missing transaction boundaries, missing idempotency, controller calling repository directly, internal error exposure, and missing failure tests.
- The purpose is not to replace Copilot Review or CodeRabbit. The purpose is to show a team-convention-based review gate that runs the same way locally and in CI.

Recommended tech stack:
- Node.js 22
- TypeScript
- Express for the sample REST API
- Vitest for tests
- tsx for TypeScript scripts
- zod for schema definition
- OpenAI JavaScript SDK for the AI review call
- GitHub Actions for PR automation

Core behavior:
1. Read AGENTS.md.
2. Read a diff.
   - In local mode, support reading from git diff.
   - Also support --diff-file demo/bad-change.patch for stable presentation demos.
   - In CI mode, compare the PR base and head refs.
3. Ask the model to review the diff strictly against AGENTS.md and backend review rules.
4. Use Structured Outputs / JSON Schema so the response conforms to a ReviewResult schema.
5. Save the structured result to reports/review-result.json.
6. Render reports/review-report.md from the JSON result.
7. Print a concise console summary.
8. In GitHub Actions, comment reports/review-report.md on the PR.

Required files:
- package.json
- tsconfig.json
- README.md
- AGENTS.md
- src/app.ts
- src/controllers/lessonProgressController.ts
- src/services/lessonProgressService.ts
- src/repositories/lessonProgressRepository.ts
- src/repositories/courseProgressRepository.ts
- src/errors/AppError.ts
- tests/lessonProgress.test.ts
- scripts/ai-review.ts
- scripts/render-review-report.ts
- scripts/mock-review-result.ts or demo/mock-review-result.json
- schemas/review-result.schema.ts
- prompts/code-review-system.md
- demo/bad-change.patch
- reports/.gitkeep
- .github/workflows/ai-review-gate.yml

AGENTS.md requirements:
Create an AGENTS.md that contains concrete team conventions for this demo:
- Controllers should be thin.
- Business logic must live in service classes.
- Repositories should not be called directly from controllers.
- User-specific data access must verify ownership or enrollment.
- Write operations that update multiple tables must use transactions.
- APIs that can be retried must be idempotent when possible.
- Do not expose internal error messages to clients.
- Add tests for authorization failure, duplicate requests, transaction failure, and validation failure when relevant.

ReviewResult schema requirements:
Use zod to define a schema like this:
- summary: string
- riskLevel: LOW | MEDIUM | HIGH | CRITICAL
- shouldBlockMerge: boolean
- findings: array of objects with:
  - category: AUTHORIZATION | INPUT_VALIDATION | TRANSACTION | IDEMPOTENCY | ERROR_HANDLING | PERFORMANCE | TEST_GAP | MAINTAINABILITY
  - severity: LOW | MEDIUM | HIGH | CRITICAL
  - file: string
  - lineHint: string
  - problem: string
  - suggestion: string
  - relatedRule: string

Structured Output implementation:
- Prefer the current OpenAI JavaScript SDK Structured Outputs helper if available.
- If the helper API differs, implement the same behavior using JSON Schema response format.
- Keep the model configurable through OPENAI_MODEL.
- Default to a reasonable small model, but make it easy to change through env.
- The script must not crash silently if OPENAI_API_KEY is missing.
- Add AI_REVIEW_MOCK=1 mode that returns a deterministic mock review result. This is important for seminar demo backup.

Local scripts:
Add npm scripts:
- npm run dev
- npm test
- npm run ai-review
- npm run ai-review:mock
- npm run ai-review:ci

Expected local usage:
- npm run ai-review -- --diff-file demo/bad-change.patch
- AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch

Markdown report requirements:
Render a readable report with:
- Title: AI Review Gate Report
- Risk level
- Short summary
- Finding count by severity
- Findings grouped by severity
- For each finding: category, file, lineHint, problem, suggestion, relatedRule
- A footer saying this is an advisory review and humans remain responsible for final approval.

GitHub Actions requirements:
Create .github/workflows/ai-review-gate.yml:
- Trigger on pull_request types: opened, synchronize, reopened
- permissions:
  contents: read
  pull-requests: write
  issues: write
- checkout with fetch-depth: 0
- setup Node.js 22
- npm ci
- run npm run ai-review:ci with OPENAI_API_KEY from secrets
- always upload or generate reports/review-report.md
- comment on the PR with gh pr comment "$PR_NUMBER" --body-file reports/review-report.md
- Do not use pull_request_target.
- Add a short comment in the YAML explaining that public fork PRs require additional secret-handling design.

Demo REST API requirements:
Implement a simple Express app with a lesson completion endpoint.
The base source files can contain reasonable architecture, but demo/bad-change.patch should show a problematic change where:
- controller directly calls repositories
- authorization/enrollment ownership check is missing
- two write operations are not wrapped in a transaction
- duplicate lesson completion is possible
- error handling exposes internal details
- tests only cover happy path

Testing requirements:
- Add at least a few Vitest tests for the current sample code.
- The tests do not have to cover the intentionally bad patch perfectly, but the project must run npm test successfully.

README requirements:
Include:
- What this project demonstrates
- Architecture diagram in text
- How AGENTS.md is used
- Why Structured Outputs are used even though final output is Markdown
- How to run local demo
- How to run mock demo
- How GitHub Actions mode works
- How this differs from generic automated PR review tools
- Known limitations and safe rollout plan:
  1. comment-only
  2. warning on HIGH
  3. fail only on CRITICAL
  4. team-approved blocking rules

Implementation constraints:
- Keep the code easy to read for a seminar audience.
- Avoid overengineering.
- Do not implement a GitHub App.
- Do not implement line-level PR comments; one summary PR comment is enough.
- Do not implement auto-fix.
- Do not commit secrets.
- Do not make unrelated changes.

Work style:
1. First inspect the repository state.
2. If the repo is empty, create the project from scratch.
3. Start with a short implementation plan.
4. Implement the files.
5. Run npm install only if needed by the environment; otherwise just update package.json/package-lock if possible.
6. Run npm test.
7. Run AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch.
8. Verify that reports/review-result.json and reports/review-report.md are generated.
9. Finish by summarizing changed files, commands run, and any remaining caveats.

Done when:
- npm test passes.
- Mock review command generates review-result.json and review-report.md.
- AGENTS.md is clearly used by scripts/ai-review.ts.
- GitHub Actions workflow exists and is plausible.
- README explains the demo end-to-end.
```

---

## 14. Codex에게 추가로 던질 수 있는 후속 프롬프트

### 후속 1: 데모 안정화

```text
Please make the demo presentation-safe.
Add a deterministic mock mode that produces a realistic review report even without OPENAI_API_KEY.
Ensure the README has a “5-minute live demo script” section with exact commands and expected outputs.
```

### 후속 2: 발표용 출력 개선

```text
Improve the Markdown report formatting for a tech seminar demo.
Make the report readable in a GitHub PR comment.
Add severity emojis, a compact summary table, and clear links between each finding and the related AGENTS.md rule.
Do not change the ReviewResult schema unless necessary.
```

### 후속 3: CI 정책 실험

```text
Add an optional CI blocking policy.
By default the workflow should be comment-only.
If AI_REVIEW_BLOCK_LEVEL is set to CRITICAL, fail the workflow only when at least one CRITICAL finding exists.
Document this rollout strategy in README.md.
```

---

## 15. 참고 공식 문서

- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- OpenAI Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex Best Practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- GitHub Actions workflow syntax: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
- GitHub Actions pull_request events: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- GitHub pull request comments API: https://docs.github.com/rest/pulls/comments
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use