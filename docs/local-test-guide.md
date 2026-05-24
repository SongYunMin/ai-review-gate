# 로컬 테스트 방법 요약

## 1. 기본 점검

```bash
npm test
npm run build
```

- `npm test`: 데모 REST API의 성공/권한 실패/중복 요청/검증 실패 흐름을 확인합니다.
- `npm run build`: TypeScript 타입 오류가 없는지 확인합니다.

## 2. 목업 리뷰 실행

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

- Gemini API를 호출하지 않습니다.
- `demo/mock-review-result.json`을 읽어 같은 JSON/Markdown 리포트 생성 흐름만 검증합니다.
- 발표 전 백업 플로우 확인용으로 가장 안전합니다.

## 3. 실제 Gemini 리뷰 실행

```bash
export GEMINI_API_KEY=...
export GEMINI_MODEL=gemini-3-flash-preview
npm run ai-review -- --diff-file demo/bad-change.patch
```

- `AGENTS.md`, `demo/bad-change.patch`, `prompts/code-review-system.md`를 읽습니다.
- Gemini API에 Structured Outputs 형식으로 리뷰를 요청합니다.
- `reports/review-result.json`, `reports/review-report.md`를 생성합니다.

## 4. 결과 확인

```bash
cat reports/review-report.md
cat reports/review-result.json
```

- Markdown은 사람이 읽는 리포트입니다.
- JSON은 자동화가 사용하는 구조화 결과입니다.
