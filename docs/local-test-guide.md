# 로컬 검증 가이드

## 1. 전체 검증

```bash
npm ci
npm run build
npm test
```

- `npm run build`: TypeScript 전체 타입 검사
- `npm test`: 데모 API, 계약 파서, 결과 정규화, GitHub API 입력, Action 정적 계약, 리포트 테스트

## 2. Mock 리뷰

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

확인할 파일:

- `reports/review-result.json`
- `reports/review-report.md`

Mock도 회사 공통 계약과 프로젝트 `AGENTS.md`를 병합하고, 모델 형식의 결과를 실제 계약 값과 변경 파일 목록으로 다시 검증합니다.

정상 기대값:

- process exit code `0`
- `Gate Decision: BLOCKED` 후보 리포트 생성
- `AI_REVIEW_ENFORCE=0`이므로 process 자체는 성공

## 3. 정책 차단 exit code

```bash
AI_REVIEW_MOCK=1 AI_REVIEW_ENFORCE=1 \
  npm run ai-review -- --diff-file demo/bad-change.patch
```

현재 mock에는 `gate=error`, `confidence=HIGH` 위반이 있으므로 exit code `10`이 정상입니다. 리포트와 JSON은 exit 전에 생성되어야 합니다.

## 4. 운영 오류 exit code

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/missing.patch
```

입력 파일이 없으므로 exit code `2`가 정상입니다. 정책 위반 exit code `10`과 혼동하면 안 됩니다.

## 5. 실제 provider 리뷰

```bash
export GEMINI_API_KEY=...
export GEMINI_MODEL=<회사에서 승인한 모델 ID>
npm run ai-review -- --diff-file demo/bad-change.patch
```

선택 설정:

```bash
export GEMINI_BASE_URL=https://approved-compatible-endpoint.example/v1/
export AI_REVIEW_MAX_DIFF_BYTES=500000
export AI_REVIEW_MAX_CHANGED_FILES=200
export AI_REVIEW_PROJECT_CONTRACT_PATHS=$'AGENTS.md\nCLAUDE.md'
```

API key나 실제 비밀값을 shell history, 문서, 테스트 fixture, report에 넣지 않습니다.
`GEMINI_BASE_URL` override는 로컬 수동 실행용입니다. 공용 reusable workflow에서는 caller가 API key destination을 바꿀 수 없습니다.

## 6. 계약 우선순위 확인

기본 계약 순서:

1. `contracts/company-global.md`
2. `AGENTS.md`
3. `CLAUDE.md`

뒤 문서가 같은 rule ID를 선언하면 앞 규칙 전체를 교체합니다. 같은 문서 안의 중복 ID는 exit code `2`의 구성 오류입니다.
`Gate: error`도 선언할 수 있지만 matching deterministic evidence가 없으면 `Enforcement: advisory`로 리포트되고 자동 차단되지 않습니다. `scripts/deterministic-review.ts`에 evaluator가 등록된 rule ID만 `Enforcement: deterministic` 자동 차단이 가능합니다.

다음 테스트가 이 동작을 검증합니다.

```bash
npm test -- tests/parseReviewContract.test.ts
```

## 7. GitHub 입력 경계 확인

```bash
npm test -- tests/githubPullRequestInput.test.ts tests/githubActionsContract.test.ts
```

검증 항목:

- contract contents URL의 `ref`가 base SHA인지
- PR changed files pagination과 rename 이전 경로 처리
- diff와 변경 파일 수 제한
- contract path traversal 거부
- Review Gate 경로에 checkout, git fetch, 대상 npm script가 없는지
- 외부 Action ref가 40자리 commit SHA인지
- 일반 build/test가 secret 없는 별도 CI workflow인지

## 8. 민감 파일 redaction 확인

```bash
npm test -- tests/sanitizeReviewInput.test.ts
```

`.env*`, credential 설정, private-key/keystore 계열 파일은 실제 변경 내용 대신 `[AI_REVIEW_REDACTED_SENSITIVE_FILE_CONTENT]` marker만 모델 입력에 남습니다. 일반 소스의 명백한 secret 대입과 token 형태도 값이 redaction되고 모델 출력은 저장 전에 다시 scrub됩니다.

`R-SEC-001`과 명시적인 git bypass flag는 다음 deterministic precheck 테스트에서 provider 호출 전 차단 여부를 확인합니다.

```bash
npm test -- tests/deterministicReview.test.ts
```

이 검사는 일반 소스 내부의 모든 secret을 찾지 않습니다. 회사 secret scanner와 provider 데이터 처리 승인은 별도로 필요합니다.

## 9. 리포트 확인

리포트에서 다음 항목을 확인합니다.

- `<!-- ai-review-gate-report -->` 숨김 marker
- `PASS`, `WARN`, `BLOCKED` decision
- 실제 contract source와 rule ID
- 계약에서 확정된 severity와 gate
- changed file, line hint, evidence, suggestion
- `AI 응답 검증 경고`

JSON에서 다음 항목을 확인합니다.

- `overallRisk`
- `shouldBlockMerge`
- `violations[]`
- `validationWarnings[]`
