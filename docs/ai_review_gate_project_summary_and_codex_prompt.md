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
| 제어권 | 외부 도구 동작 방식에 의존 | 팀이 스키마, 심각도, 실패 조건 제어 |
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

## 프로젝트 개요

이 저장소는 에듀테크 서비스를 위한 Node.js TypeScript REST API 백엔드입니다.

## 백엔드 컨벤션

- 컨트롤러는 얇게 유지해야 합니다.
- 비즈니스 로직은 서비스 클래스에 있어야 합니다.
- 컨트롤러에서 repository를 직접 호출하면 안 됩니다.
- 사용자별 데이터 접근은 소유권 또는 수강 등록 여부를 검증해야 합니다.
- 여러 테이블을 갱신하는 쓰기 작업은 트랜잭션을 사용해야 합니다.
- 재시도될 수 있는 API는 가능하면 멱등성을 가져야 합니다.
- 내부 오류 메시지를 클라이언트에 노출하면 안 됩니다.

## 리뷰 규칙

백엔드 변경을 리뷰할 때는 다음 항목을 확인합니다.

1. 권한 및 소유권 검증
2. 입력 검증
3. 트랜잭션 경계
4. 멱등성
5. 오류 메시지 보호
6. 실패 케이스 테스트 커버리지
7. 성능 영향
```

---

## 6. Structured Outputs가 필요한 이유

최종적으로 사람이 보는 결과는 Markdown이어도 됩니다.

하지만 모델에게 바로 Markdown을 쓰게 하는 것보다, 먼저 JSON을 받고 그 JSON을 Markdown으로 렌더링하는 구조가 훨씬 안정적입니다.

```text
AI가 바로 Markdown 작성
  → 사람이 읽기에는 좋음
  → 프로그램이 심각도, category, 실패 조건을 안정적으로 처리하기 어려움

AI가 JSON 작성
  → 우리 코드가 Markdown으로 변환
  → CI 실패 조건, 심각도 정렬, 규칙 연결, 산출물 저장 가능
```

### 필요한 자동화 판단

- `CRITICAL` 지적 사항이 있으면 CI를 실패시킬까?
- `TEST_GAP`은 경고로만 둘까?
- 같은 파일의 지적 사항을 묶을까?
- `relatedRule`을 통해 AGENTS.md의 어떤 규칙을 위반했는지 보여줄까?
- JSON 산출물을 저장해서 추후 dashboard로 확장할까?

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

### 워크플로 개요

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
      - name: 저장소 체크아웃
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: 의존성 설치
        run: npm ci

      - name: AI Review Gate 실행
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL: ${{ vars.GEMINI_MODEL || 'gemini-3-flash-preview' }}
          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
          PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: npm run ai-review:ci

      - name: PR에 리뷰 리포트 코멘트 작성
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
- 외부 fork PR이 있는 공개 repo에서는 secret 노출과 신뢰할 수 없는 코드 실행을 별도로 설계해야 합니다.
- 초기 버전에서는 PR 코멘트만 남기고 머지 차단은 하지 않는 것이 좋습니다.
- 단계적으로 `CRITICAL`만 차단 → 특정 category 차단으로 확장합니다.

---

## 10. 구현 범위

### 반드시 구현

- REST API 예제 코드
- 의도적으로 문제가 있는 diff 또는 patch 파일
- `AGENTS.md`
- `scripts/ai-review.ts`
- Structured Output schema
- Markdown 리포트 렌더러
- `reports/review-result.json` 생성
- `reports/review-report.md` 생성
- GitHub Actions 워크플로
- README 데모 가이드

### 있으면 좋은 것

- `--diff-file` 옵션
- `AI_REVIEW_MOCK=1` 백업 모드
- `shouldBlockMerge` 기준을 env로 조정
- `demo/bad-change.patch` 제공
- 발표 당일 API 장애 대비 목업 결과 제공

### 하지 않을 것

- GraphQL 사용
- GitHub App 구현
- 실제 라인별 리뷰 코멘트 구현
- 자동 수정 PR 생성
- 자동 머지 차단을 기본값으로 강제
- 사내 레포와 직접 연동

---

## 11. 데모 흐름

### 1단계. AGENTS.md 확인

```bash
cat AGENTS.md
```

보여줄 규칙:

- 컨트롤러는 얇게 유지해야 합니다.
- 비즈니스 로직은 서비스 클래스에 있어야 합니다.
- 사용자별 데이터 접근은 소유권 또는 수강 등록 여부를 검증해야 합니다.
- 여러 테이블을 갱신하는 쓰기 작업은 트랜잭션을 사용해야 합니다.
- 재시도될 수 있는 API는 가능하면 멱등성을 가져야 합니다.

### 2단계. 문제가 있는 REST API diff 확인

```bash
git diff origin/main...HEAD
```

또는 데모 안정성을 위해:

```bash
cat demo/bad-change.patch
```

### 3단계. 로컬 AI Review Gate 실행

기본 점검:

```bash
npm test
npm run build
```

- `npm test`: 데모 REST API의 성공/권한 실패/중복 요청/검증 실패 흐름을 확인합니다.
- `npm run build`: TypeScript 타입 오류가 없는지 확인합니다.

실제 Gemini API 호출:

```bash
npm run ai-review -- --diff-file demo/bad-change.patch
```

- `AGENTS.md`, `demo/bad-change.patch`, `prompts/code-review-system.md`를 읽습니다.
- Gemini API에 structured output 형식으로 리뷰를 요청합니다.
- `reports/review-result.json`, `reports/review-report.md`를 생성합니다.

API key 없이 확인하는 백업 모드:

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

- Gemini API를 호출하지 않습니다.
- `demo/mock-review-result.json`을 읽어 같은 JSON/Markdown 리포트 생성 흐름만 검증합니다.

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
- AI Review Gate 워크플로 실행
- PR 코멘트 생성
- Markdown 리포트 확인

---

## 12. 발표 중 예상 질문과 답변

### Q. 이미 Copilot Review나 CodeRabbit 같은 도구가 있는데 왜 이걸 만들죠?

A. 이 프로젝트는 범용 리뷰 도구를 대체하려는 것이 아닙니다. 핵심은 `AGENTS.md`에 있는 팀 컨벤션을 로컬과 CI에서 같은 기준으로 반복 실행하는 것입니다. 범용 도구가 “리뷰를 해주는 서비스”라면, AI Review Gate는 “팀 리뷰 기준을 실행하는 파이프라인”입니다.

### Q. 최종 결과가 Markdown이면 Structured Outputs가 꼭 필요한가요?

A. 사람이 보는 최종 결과는 Markdown이 맞습니다. 하지만 CI는 심각도, category, 차단 여부, relatedRule 같은 구조화된 값을 처리해야 합니다. 그래서 AI 출력은 JSON으로 받고, 우리 코드가 Markdown으로 렌더링하는 구조가 더 안정적입니다.

### Q. AGENTS.md가 너무 부정확하면 어떻게 하나요?

A. 초반에는 짧고 명확한 규칙만 넣는 것이 좋습니다. 리뷰 결과를 보면서 반복적으로 잘 잡는 규칙은 유지하고, 오탐을 만드는 규칙은 수정합니다.

### Q. AI가 틀린 리뷰를 하면요?

A. 초기에는 머지 차단으로 쓰지 않고 코멘트 전용으로 시작합니다. 이후 신뢰도가 높은 category만 경고 또는 차단으로 승격합니다.

---

# 13. Codex 요청 프롬프트

아래 프롬프트를 Codex에 그대로 붙여넣으면 됩니다.

```text
내부 30분 기술 세미나용 데모 프로젝트를 구현하세요.

프로젝트 제목:
Vibe Coding에서 Verify Coding으로: AGENTS.md 기반 AI Review Gate 만들기

목표:
팀이 로컬과 GitHub Actions에서 AI Review Gate를 실행하는 방식을 보여주는 작지만 현실적인 데모 저장소를 만드세요. Review Gate는 `AGENTS.md`를 팀 컨벤션 기준으로 읽고, PR diff를 그 기준에 맞춰 리뷰한 뒤, 구조화된 JSON 리뷰 결과를 받고, Markdown 리포트를 렌더링하고, GitHub Actions에서 해당 리포트를 PR에 코멘트로 남겨야 합니다.

중요 맥락:
- 백엔드 엔지니어링 세미나용입니다.
- GraphQL은 사용하지 마세요.
- 단순한 REST API 데모를 사용하세요.
- 핵심 데모 도메인은 에듀테크 강의 완료 API입니다.
  POST /api/lessons/:lessonId/complete
- 데모에는 권한 검증 누락, 트랜잭션 경계 누락, 멱등성 누락, 컨트롤러의 repository 직접 호출, 내부 오류 노출, 실패 테스트 누락처럼 리뷰할 가치가 있는 문제를 의도적으로 포함해야 합니다.
- 목적은 Copilot Review나 CodeRabbit을 대체하는 것이 아닙니다. 목적은 로컬과 CI에서 같은 방식으로 실행되는 팀 컨벤션 기반 리뷰 게이트를 보여주는 것입니다.

권장 기술 스택:
- Node.js 22
- TypeScript
- 샘플 REST API용 Express
- 테스트용 Vitest
- TypeScript 스크립트 실행용 tsx
- 스키마 정의용 zod
- AI 리뷰 호출용 OpenAI JavaScript SDK
- PR 자동화용 GitHub Actions

핵심 동작:
1. `AGENTS.md`를 읽습니다.
2. diff를 읽습니다.
   - 로컬 모드에서는 `git diff`를 읽을 수 있어야 합니다.
   - 안정적인 발표 데모를 위해 `--diff-file demo/bad-change.patch`도 지원해야 합니다.
   - CI 모드에서는 PR base/head ref를 비교해야 합니다.
3. 모델에게 diff를 `AGENTS.md`와 백엔드 리뷰 규칙 기준으로만 리뷰하도록 요청합니다.
4. Structured Outputs / JSON Schema를 사용해 응답이 `ReviewResult` 스키마를 따르게 합니다.
5. 구조화된 결과를 `reports/review-result.json`에 저장합니다.
6. JSON 결과에서 `reports/review-report.md`를 렌더링합니다.
7. 간결한 콘솔 요약을 출력합니다.
8. GitHub Actions에서는 `reports/review-report.md`를 PR에 코멘트로 남깁니다.

필수 파일:
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
- scripts/mock-review-result.ts 또는 demo/mock-review-result.json
- schemas/review-result.schema.ts
- prompts/code-review-system.md
- demo/bad-change.patch
- reports/.gitkeep
- .github/workflows/ai-review-gate.yml

AGENTS.md 요구사항:
이 데모를 위한 구체적인 팀 컨벤션을 담은 `AGENTS.md`를 만드세요.
- 컨트롤러는 얇게 유지해야 합니다.
- 비즈니스 로직은 서비스 클래스에 있어야 합니다.
- 컨트롤러에서 repository를 직접 호출하면 안 됩니다.
- 사용자별 데이터 접근은 소유권 또는 수강 등록 여부를 검증해야 합니다.
- 여러 테이블을 갱신하는 쓰기 작업은 트랜잭션을 사용해야 합니다.
- 재시도될 수 있는 API는 가능하면 멱등성을 가져야 합니다.
- 내부 오류 메시지를 클라이언트에 노출하면 안 됩니다.
- 관련성이 있는 경우 권한 실패, 중복 요청, 트랜잭션 실패, 검증 실패 테스트를 추가해야 합니다.

ReviewResult 스키마 요구사항:
zod로 다음과 같은 스키마를 정의하세요.
- summary: string
- riskLevel: LOW | MEDIUM | HIGH | CRITICAL
- shouldBlockMerge: boolean
- findings: 다음 필드를 가진 객체 배열
  - category: AUTHORIZATION | INPUT_VALIDATION | TRANSACTION | IDEMPOTENCY | ERROR_HANDLING | PERFORMANCE | TEST_GAP | MAINTAINABILITY
  - severity: LOW | MEDIUM | HIGH | CRITICAL
  - file: string
  - lineHint: string
  - problem: string
  - suggestion: string
  - relatedRule: string

Structured Output 구현:
- 가능하면 현재 OpenAI JavaScript SDK의 Structured Outputs helper를 우선 사용하세요.
- helper API가 다르면 JSON Schema response format으로 같은 동작을 구현하세요.
- 모델은 `GEMINI_MODEL`로 바꿀 수 있게 하세요.
- 기본값은 합리적인 작은 모델로 두되, env로 쉽게 변경할 수 있게 하세요.
- `GEMINI_API_KEY`가 없을 때 스크립트가 조용히 실패하면 안 됩니다.
- 결정적인 목업 리뷰 결과를 반환하는 `AI_REVIEW_MOCK=1` 모드를 추가하세요. 세미나 데모 백업용으로 중요합니다.

로컬 스크립트:
다음 npm scripts를 추가하세요.
- npm run dev
- npm test
- npm run ai-review
- npm run ai-review:mock
- npm run ai-review:ci

예상 로컬 사용법:
- npm run ai-review -- --diff-file demo/bad-change.patch
- AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch

Markdown 리포트 요구사항:
읽기 쉬운 리포트를 렌더링하세요.
- 제목: AI Review Gate 리포트
- 위험도
- 짧은 요약
- 심각도별 지적 사항 수
- 심각도별로 묶은 지적 사항
- 각 지적 사항의 category, file, lineHint, problem, suggestion, relatedRule
- 이 리포트는 보조 검토 자료이며 최종 승인은 사람이 책임진다는 footer

GitHub Actions 요구사항:
`.github/workflows/ai-review-gate.yml`을 만드세요.
- `pull_request`의 `opened`, `synchronize`, `reopened` 이벤트에서 실행
- permissions:
  contents: read
  pull-requests: write
  issues: write
- `fetch-depth: 0`으로 checkout
- Node.js 22 설정
- npm ci
- secrets의 `GEMINI_API_KEY`로 `npm run ai-review:ci` 실행
- 항상 `reports/review-report.md`를 생성하거나 업로드
- `gh pr comment "$PR_NUMBER" --body-file reports/review-report.md`로 PR에 코멘트 작성
- `pull_request_target`은 사용하지 마세요.
- 공개 fork PR에는 별도의 secret 처리 설계가 필요하다는 짧은 주석을 YAML에 추가하세요.

데모 REST API 요구사항:
강의 완료 endpoint가 있는 단순한 Express 앱을 구현하세요.
기본 소스 파일은 합리적인 아키텍처를 가질 수 있지만, `demo/bad-change.patch`는 다음 문제가 있는 변경을 보여줘야 합니다.
- 컨트롤러가 repository를 직접 호출
- 권한 또는 수강 등록 소유권 검증 누락
- 두 쓰기 작업이 트랜잭션으로 묶이지 않음
- 중복 강의 완료 가능
- 오류 처리가 내부 상세를 노출
- 테스트가 성공 경로만 다룸

테스트 요구사항:
- 현재 샘플 코드에 대해 Vitest 테스트를 몇 개 이상 추가하세요.
- 의도적으로 나쁜 patch를 완벽히 커버할 필요는 없지만, 프로젝트는 `npm test`를 성공적으로 실행해야 합니다.

README 요구사항:
다음 내용을 포함하세요.
- 이 프로젝트가 보여주는 것
- 텍스트 아키텍처 다이어그램
- `AGENTS.md` 사용 방식
- 최종 출력은 Markdown인데도 Structured Outputs를 쓰는 이유
- 로컬 데모 실행 방법
- 목업 데모 실행 방법
- GitHub Actions 모드 동작 방식
- 일반 자동 PR 리뷰 도구와의 차이
- 알려진 한계와 안전한 도입 계획
  1. 코멘트 전용
  2. HIGH는 경고
  3. CRITICAL만 실패 처리
  4. 팀 승인 차단 규칙만 적용

구현 제약:
- 세미나 청중이 읽기 쉬운 코드를 유지하세요.
- 과도하게 설계하지 마세요.
- GitHub App은 구현하지 마세요.
- 라인 단위 PR 코멘트는 구현하지 마세요. 하나의 요약 PR 코멘트면 충분합니다.
- 자동 수정은 구현하지 마세요.
- secret을 커밋하지 마세요.
- 관련 없는 변경을 만들지 마세요.

작업 방식:
1. 먼저 저장소 상태를 확인하세요.
2. 저장소가 비어 있으면 프로젝트를 처음부터 만드세요.
3. 짧은 구현 계획으로 시작하세요.
4. 파일을 구현하세요.
5. 환경상 필요할 때만 `npm install`을 실행하고, 가능하면 `package.json`/`package-lock.json`만 업데이트하세요.
6. `npm test`를 실행하세요.
7. `AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch`를 실행하세요.
8. `reports/review-result.json`과 `reports/review-report.md`가 생성되는지 확인하세요.
9. 변경 파일, 실행한 명령, 남은 주의사항을 요약하며 마무리하세요.

완료 조건:
- `npm test`가 통과합니다.
- 목업 리뷰 명령이 `review-result.json`과 `review-report.md`를 생성합니다.
- `scripts/ai-review.ts`에서 `AGENTS.md`를 명확히 사용합니다.
- GitHub Actions 워크플로가 존재하고 현실적으로 동작 가능한 형태입니다.
- README가 데모를 처음부터 끝까지 설명합니다.
```

---

## 14. Codex에게 추가로 던질 수 있는 후속 프롬프트

### 후속 1: 데모 안정화

```text
데모를 발표에 안전한 상태로 정리해주세요.
GEMINI_API_KEY가 없어도 현실적인 리뷰 리포트를 생성하는 결정적 목업 모드를 추가해주세요.
README에 정확한 명령과 예상 출력이 포함된 “5분 라이브 데모 스크립트” 섹션을 넣어주세요.
```

### 후속 2: 발표용 출력 개선

```text
기술 세미나 데모에 맞게 Markdown 리포트 형식을 개선해주세요.
GitHub PR 코멘트에서 읽기 쉬운 리포트로 만들어주세요.
심각도 표시, 간결한 요약 표, 각 지적 사항과 관련 `AGENTS.md` 규칙의 연결을 명확히 추가해주세요.
필요하지 않다면 `ReviewResult` 스키마는 변경하지 마세요.
```

### 후속 3: CI 정책 실험

```text
선택형 CI 차단 정책을 추가해주세요.
기본 워크플로는 코멘트 전용이어야 합니다.
`AI_REVIEW_BLOCK_LEVEL`이 `CRITICAL`로 설정된 경우에만, CRITICAL 지적 사항이 하나 이상 있을 때 워크플로를 실패 처리하세요.
이 도입 전략을 README.md에 문서화하세요.
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
