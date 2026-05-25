# 로컬 테스트 방법 요약

이 문서는 `AGENTS.md Review Contract + diff -> 구조화된 rule violation 결과 -> Markdown 리포트` 흐름을 로컬에서 확인하는 방법을 정리합니다.

## 1. 기본 점검

```bash
npm run build
npm test
```

- `npm run build`: TypeScript 타입 오류가 없는지 확인합니다.
- `npm test`: 데모 REST API, Review Contract parser, Markdown renderer 테스트를 실행합니다.

주요 테스트 파일:

- `tests/lessonProgress.test.ts`: 데모 REST API의 성공/권한 실패/중복 요청/검증 실패 흐름
- `tests/parseReviewContract.test.ts`: `AGENTS.md`의 Review Contract 파싱
- `tests/renderReviewReport.test.ts`: `violations` 기반 Markdown 리포트 렌더링

## 2. 목업 리뷰 실행

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

- Gemini API를 호출하지 않습니다.
- `demo/mock-review-result.json`을 읽어 `ReviewResultSchema`로 검증합니다.
- `reports/review-result.json`과 `reports/review-report.md`를 생성합니다.
- mock 결과는 `R-AUTH-001`, `R-TX-001`, `R-IDEMP-001`, `R-ARCH-001`, `R-ERR-001`, `R-TEST-001` 위반을 보여줍니다.
- 발표 전 백업 플로우 확인용으로 가장 안전합니다.

## 3. 목업 enforce 모드 확인

```bash
AI_REVIEW_MOCK=1 AI_REVIEW_ENFORCE=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

- `shouldBlockMerge`가 `true`이면 non-zero exit으로 종료합니다.
- 기본 모드는 리포트 생성 전용이며, `AI_REVIEW_ENFORCE=1`이 있을 때만 gate 결정으로 실패합니다.
- 현재 mock 결과는 `gate = "error"`와 `confidence = "HIGH"` 위반을 포함하므로 enforce 모드에서 실패하는 것이 정상입니다.

## 4. 실제 Gemini 리뷰 실행

```bash
export GEMINI_API_KEY=...
export GEMINI_MODEL=gemini-3-flash-preview
npm run ai-review -- --diff-file demo/bad-change.patch
```

- `AGENTS.md` 원문과 `scripts/parse-review-contract.ts`가 파싱한 Review Contract를 함께 프롬프트에 넣습니다.
- `prompts/code-review-system.md`는 모델을 일반 PR 리뷰어가 아니라 Review Contract evaluator로 제한합니다.
- Gemini OpenAI-compatible API에 Zod Structured Outputs 형식으로 리뷰를 요청합니다.
- `reports/review-result.json`, `reports/review-report.md`를 생성합니다.

## 5. CI context 포함 실행

GitHub Actions에서는 build/test 결과를 `reports/ci-context.md`에 저장한 뒤 Review Gate에 전달합니다.
로컬에서 같은 입력 형태를 확인하려면 임시 context 파일을 만들고 실행합니다.

```bash
mkdir -p reports
{
  echo "# CI Context"
  echo
  echo "## npm run build"
  npm run build
  echo
  echo "## npm test"
  npm test
} > reports/ci-context.md 2>&1

AI_REVIEW_MOCK=1 npm run ai-review:ci -- --diff-file demo/bad-change.patch --ci-context-file reports/ci-context.md
```

- `npm run ai-review:ci`는 내부적으로 `scripts/ai-review.ts --ci`를 실행합니다.
- 실제 CI에서는 `PR_BASE_SHA`와 `PR_HEAD_SHA` 기준으로 diff를 읽습니다.
- 로컬에서는 `--diff-file`을 함께 전달하면 PR SHA 없이도 CI context 포함 경로를 검증할 수 있습니다.
- 로컬에서 `--ci`의 실제 PR diff 모드를 쓰려면 `PR_BASE_SHA`와 `PR_HEAD_SHA` 환경 변수가 필요합니다.

## 6. 결과 확인

```bash
cat reports/review-report.md
cat reports/review-result.json
```

- Markdown은 사람이 읽는 PR 리포트입니다.
- JSON은 CI나 후속 자동화가 읽는 구조화 결과입니다.

리포트에서 확인할 항목:

- `<!-- ai-review-gate-report -->` 숨김 마커
- `R-AUTH-001` 같은 rule ID
- severity, gate, confidence
- evidence, problem, suggestion
- 마지막 고지 문구: `이 리포트는 자동화된 보조 검토 자료이며, 최종 승인은 사람이 책임집니다.`

JSON에서 확인할 항목:

- `overallRisk`
- `shouldBlockMerge`
- `violations[]`
- 각 violation의 `ruleId`, `gate`, `confidence`, `evidence`
