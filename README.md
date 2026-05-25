# AI Review Gate: AGENTS.md를 실행 가능한 Review Contract로 만들기

이 저장소는 작은 Node.js TypeScript Express REST API 데모와 함께, 팀 컨벤션 문서인 `AGENTS.md`를 실행 가능한 Review Contract로 바꾸는 흐름을 보여줍니다.

이 프로젝트는 Copilot Review나 CodeRabbit을 대체하려는 도구가 아닙니다.
그 도구들은 범용 AI 리뷰어로 강력하고 instruction 파일도 읽을 수 있습니다.

이 데모의 초점은 더 좁습니다.
팀 규칙을 안정적인 rule ID, severity, gate action, evidence, suggestion이 있는 계약으로 만들고, 로컬 개발자와 GitHub Actions가 같은 기준으로 실행하게 하는 것입니다.

## 해결하려는 문제

팀 컨벤션은 보통 문서로 끝나기 쉽습니다.
리뷰어가 매번 기억해서 적용해야 하고, CI는 그 의미를 직접 읽지 못합니다.

AI Review Gate는 다음 흐름을 데모합니다.

```text
AGENTS.md Review Contract + PR diff + optional CI context
  -> Structured rule-violation result
  -> Markdown PR report
  -> optional CI gate decision
```

범용 코멘트 생성이 아니라, 팀 규칙을 기계가 읽을 수 있는 위반 결과로 변환하는 것이 핵심입니다.

## 데모 API

REST API 데모는 에듀테크 강의 완료 흐름을 다룹니다.

- `POST /api/lessons/:lessonId/complete`
- controller, service, repository 계층 분리
- 사용자 수강 등록 여부 확인
- 중복 완료 요청의 멱등 처리
- 테스트를 통한 실패 경로 검증

## Review Contract 형식

`AGENTS.md`에는 사람이 읽는 컨벤션과 함께 `## Review Contract` 섹션이 있습니다.
각 규칙은 단순한 Markdown 패턴으로 작성되어 `scripts/parse-review-contract.ts`가 파싱합니다.

```md
### R-AUTH-001: Ownership or enrollment validation is required

Severity: CRITICAL
Gate: error
Applies to:
- src/controllers/**
- src/services/**

Rule:
사용자별 학습 진도를 읽거나 쓰는 API는 데이터 접근 또는 변경 전에 소유권이나 코스 수강 등록 여부를 검증해야 합니다.

Violation examples:
- lessonId만으로 강의를 완료하면서 인증 사용자의 코스 수강 여부를 확인하지 않습니다.

Expected evidence:
- 변경된 API 경로 또는 service 메서드
- 누락된 소유권 또는 수강 등록 검증
```

현재 포함된 규칙:

- `R-ARCH-001`: 컨트롤러는 얇게 유지
- `R-AUTH-001`: 소유권 또는 수강 등록 검증
- `R-TX-001`: 여러 쓰기 작업의 트랜잭션 또는 원자적 경계
- `R-IDEMP-001`: 재시도 가능한 쓰기 API의 멱등성
- `R-ERR-001`: 내부 오류 메시지 노출 금지
- `R-TEST-001`: critical write API의 실패 경로 테스트

## Structured Outputs를 쓰는 이유

Markdown 리뷰 코멘트는 사람이 읽기 좋지만 CI가 안정적으로 판단하기 어렵습니다.
이 프로젝트는 먼저 Zod `ReviewResultSchema`로 검증되는 JSON을 생성합니다.

핵심 출력은 `findings`가 아니라 `violations`입니다.

```json
{
  "overallRisk": "CRITICAL",
  "shouldBlockMerge": true,
  "violations": [
    {
      "ruleId": "R-AUTH-001",
      "severity": "CRITICAL",
      "gate": "error",
      "confidence": "HIGH",
      "evidence": "diff에 근거한 구체 증거",
      "suggestion": "수정 제안"
    }
  ]
}
```

`shouldBlockMerge`는 `gate = "error"`이고 confidence가 `MEDIUM` 또는 `HIGH`인 실제 위반이 있을 때만 `true`가 됩니다.

## 로컬 사용

의존성 설치와 기본 검증:

```bash
npm install
npm run build
npm test
```

현재 로컬 diff를 리뷰:

```bash
npm run ai-review
```

패치 파일을 리뷰:

```bash
npm run ai-review -- --diff-file demo/bad-change.patch
```

실제 Gemini OpenAI-compatible API 호출에는 `GEMINI_API_KEY`가 필요합니다.

```bash
export GEMINI_API_KEY=...
export GEMINI_MODEL=gemini-3-flash-preview
npm run ai-review -- --diff-file demo/bad-change.patch
```

## Mock 사용

발표나 오프라인 데모에서는 mock 모드를 사용합니다.
이 모드는 API key, 네트워크, quota에 의존하지 않고 같은 JSON 검증과 Markdown 렌더링 경로를 실행합니다.

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

생성 파일:

- `reports/review-result.json`
- `reports/review-report.md`

enforce 동작은 환경 변수로 확인할 수 있습니다.

```bash
AI_REVIEW_MOCK=1 AI_REVIEW_ENFORCE=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

## CI 사용

GitHub Actions 워크플로우는 `pull_request`의 `opened`, `synchronize`, `reopened`에서 실행됩니다.
보안상 `pull_request_target`을 사용하지 않습니다.

CI 흐름:

1. `npm ci`
2. `npm run build`와 `npm test` 출력을 `reports/ci-context.md`에 저장
3. `npm run ai-review:ci -- --ci-context-file reports/ci-context.md`
4. `reports/` artifact 업로드
5. 숨김 마커 `<!-- ai-review-gate-report -->`가 있는 기존 bot comment를 업데이트하거나 새로 작성

기본값은 comment/report only입니다.
`AI_REVIEW_ENFORCE=1`일 때만 `shouldBlockMerge === true` 결과가 워크플로우 실패로 이어집니다.

공개 fork PR에는 저장소 secret이 전달되지 않습니다.
실제 운영에서 외부 PR까지 지원하려면 별도의 secret 처리와 신뢰 경계 설계가 필요합니다.

## 안전한 도입 계획

1. comment only로 시작합니다.
2. `HIGH`는 warning으로만 표시합니다.
3. `CRITICAL`만 실패 처리합니다.
4. 팀 합의가 끝난 rule ID만 선택적으로 fail 대상으로 올립니다.

## 프로젝트 구조

```text
AGENTS.md
  -> 사람이 읽는 팀 컨벤션
  -> Review Contract rule ID와 gate policy

scripts/parse-review-contract.ts
  -> AGENTS.md Review Contract 파싱

scripts/ai-review.ts
  -> diff, contract, optional CI context를 모델 또는 mock에 전달
  -> reports/review-result.json 저장

scripts/render-review-report.ts
  -> 구조화 JSON을 Markdown PR report로 렌더링

schemas/review-result.schema.ts
  -> rule violation 중심 Structured Output 스키마
```
