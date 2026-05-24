# Vibe Coding에서 Verify Coding으로: AGENTS.md 기반 AI Review Gate 만들기

이 데모는 백엔드 팀이 로컬과 CI에서 실행할 수 있는 AI Review Gate를 보여줍니다. `AGENTS.md`를 팀 컨벤션의 기준 파일로 읽고, PR diff를 그 기준에 맞춰 리뷰한 뒤, 구조화된 JSON 결과를 받아 Markdown 리포트로 렌더링하고 GitHub PR에 요약 코멘트를 남깁니다.

## 이 프로젝트가 보여주는 것

- 간단한 Express REST API: `POST /api/lessons/:lessonId/complete`
- `git diff` 또는 `demo/bad-change.patch`를 읽을 수 있는 로컬 리뷰 명령
- Gemini API를 호출하지 않아도 발표에서 안전하게 사용할 수 있는 목업 모드
- Gemini OpenAI-compatible API, OpenAI JavaScript SDK, Zod 스키마를 사용한 Structured Outputs
- `reports/review-report.md`를 PR에 코멘트로 남기는 GitHub Actions 자동화

## 아키텍처

```text
개발자 또는 GitHub Actions
  -> scripts/ai-review.ts
      -> AGENTS.md 읽기
      -> git diff 또는 demo/bad-change.patch 읽기
      -> Gemini OpenAI-compatible API 또는 목업 결과 호출
      -> ReviewResultSchema 검증
      -> reports/review-result.json 저장
      -> scripts/render-review-report.ts 호출
          -> reports/review-report.md 저장
```

```text
REST API 데모
  app.ts
    -> lessonProgressController.ts
        -> lessonProgressService.ts
            -> lessonProgressRepository.ts
            -> courseProgressRepository.ts
```

## AGENTS.md 사용 방식

`scripts/ai-review.ts`는 실행할 때마다 `AGENTS.md`를 읽고 PR diff와 함께 모델 입력에 포함합니다. 모델은 해당 컨벤션을 기준으로만 리뷰하도록 지시받으며, 각 지적 사항에는 관련된 `AGENTS.md` 규칙을 함께 적어야 합니다.

## Markdown 전에 Structured Outputs를 쓰는 이유

사람은 Markdown을 읽지만, 자동화에는 안정적인 데이터 구조가 필요합니다. Review Gate는 먼저 `ReviewResultSchema`로 검증된 `reports/review-result.json`을 저장한 뒤, 그 JSON을 `reports/review-report.md`로 렌더링합니다. 이렇게 하면 CI에서 심각도별 개수를 세거나, 향후 차단 규칙을 판단하거나, 기계가 읽을 수 있는 산출물을 보존할 수 있습니다.

## 로컬 데모

```bash
npm install
npm test
npm run ai-review -- --diff-file demo/bad-change.patch
```

실제 Gemini API 호출 모드로 실행하려면 다음 환경 변수를 설정합니다.

```bash
export GEMINI_API_KEY=...
export GEMINI_MODEL=gemini-3-flash-preview
```

`GEMINI_MODEL`은 선택값이며 기본값은 `gemini-3-flash-preview`입니다.

## 목업 데모

네트워크, quota, API key 리스크 없이 발표해야 할 때는 목업 모드를 사용합니다. 이 경로는 실제 Gemini API를 호출하지 않으므로 발표 백업용으로 적합합니다.

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

이 명령은 `demo/mock-review-result.json`을 읽고 동일한 스키마로 검증한 뒤 다음 파일을 생성합니다.

- `reports/review-result.json`
- `reports/review-report.md`

## GitHub Actions 모드

`.github/workflows/ai-review-gate.yml`은 PR이 `opened`, `synchronize`, `reopened` 상태가 될 때 실행됩니다. 전체 git history를 checkout하고, Node.js 22 의존성을 설치한 뒤, PR base/head SHA를 비교해서 `npm run ai-review:ci`를 실행합니다. 이후 생성된 리포트를 산출물로 업로드하고 `reports/review-report.md`를 PR에 코멘트로 남깁니다.

워크플로는 의도적으로 `pull_request_target`이 아니라 `pull_request`를 사용합니다. 공개 fork PR에서 실제 Gemini 호출을 허용하려면 별도의 secret 처리 설계가 필요합니다.

## 범용 PR 리뷰 도구와의 차이

이 프로젝트는 Copilot Review나 CodeRabbit을 대체하기 위한 것이 아닙니다. 목표는 더 좁습니다. 팀이 소유한 `AGENTS.md` 컨벤션을 로컬과 CI에서 반복 실행 가능한 Review Gate로 바꾸는 것입니다. 팀은 스키마, 심각도 category, 프롬프트, 리포트 렌더러, 향후 차단 정책을 직접 제어합니다.

## 알려진 한계와 안전한 도입 계획

알려진 한계:

- 이 데모는 실제 데이터베이스가 아니라 인메모리 repository를 사용합니다.
- AI 결과는 보조 검토 성격이며, 이슈를 놓치거나 오탐을 만들 수 있습니다.
- 워크플로는 하나의 요약 코멘트만 남기며 라인 단위 리뷰 코멘트는 생성하지 않습니다.
- 현재 CI 흐름은 코멘트 전용이며, `shouldBlockMerge` 값만으로 실패 처리하지 않습니다.

안전한 도입 순서:

1. 코멘트 전용으로 시작합니다.
2. `HIGH`는 경고로 표시합니다.
3. `CRITICAL`만 실패 처리합니다.
4. 팀이 승인한 차단 규칙만 적용합니다.
