# AI Review Gate

회사 공통 개발 원칙과 프로젝트별 규칙을 실행 가능한 Review Contract로 만들고, PR diff를 구조화된 위반 결과와 merge check로 연결하는 Node.js TypeScript 도구입니다.

이 저장소의 핵심은 범용 AI 코멘트가 아니라 다음 정책 실행 흐름입니다.

```text
회사 공통 Review Contract
  < base SHA의 AGENTS.md
  < base SHA의 CLAUDE.md
              + PR diff
                  ↓
          AI structured result
                  ↓
     contract 기반 결정론적 재검증
                  ↓
       JSON + PR report + optional gate
```

이 기능은 PR CI gate입니다. build, test, deploy는 별도 workflow가 책임지며 AI Review Gate가 대체하지 않습니다.

## 운영 신뢰 경계

공용 workflow는 `pull_request_target`의 base 브랜치 컨텍스트에서 실행합니다. 대신 아래 불변식을 지켜 fork PR의 코드가 secret이나 write token을 만질 수 없게 합니다.

- PR head를 checkout, fetch, build, test 또는 실행하지 않습니다.
- GitHub API로 PR diff와 변경 파일 목록만 데이터로 읽습니다.
- 프로젝트 계약은 PR이 바꾼 head가 아니라 `pull_request.base.sha`에서 읽습니다.
- 중앙 composite action의 코드와 dependency만 실행합니다.
- action과 reusable workflow는 같은 commit을 가리키는 GitHub Cloud `$/` self reference를 사용합니다.
- PR head가 평가 중 바뀌면 오래된 결과 코멘트를 작성하지 않습니다.

`pull_request_target`에 `actions/checkout`, PR archive, `git fetch`, 대상 레포의 package script 실행을 추가하면 이 신뢰 경계가 깨집니다.

## Review Contract 계층

중앙의 [회사 공통 계약](contracts/company-global.md)을 먼저 읽고, `contract_paths`에 지정한 프로젝트 문서를 순서대로 합칩니다. 기본 순서는 다음과 같습니다.

1. `contracts/company-global.md`
2. base SHA의 `AGENTS.md`
3. base SHA의 `CLAUDE.md`

같은 `ruleId`가 다시 나오면 후순위 프로젝트 규칙이 앞 규칙 전체를 교체합니다. 프로젝트가 공통 규칙을 끄려면 같은 ID로 `Gate: off`를 선언할 수 있습니다. 같은 문서 안의 중복 ID는 구성 오류입니다.

프로젝트 문서에 `## Review Contract`가 없으면 사람이 읽는 지침으로만 남고 merge gate 규칙에는 포함되지 않습니다.

프로젝트는 `Gate: error`를 그대로 선언할 수 있습니다. 다만 모델 결과만 있는 error finding은 `Enforcement: advisory`로 표시되고 자동 merge 차단에는 사용되지 않습니다. 동일 rule/file의 deterministic evidence가 있을 때만 `Enforcement: deterministic`이 되어 차단됩니다. 현재 자동 차단 가능 ID는 `R-SEC-001`, `R-BYPASS-001`입니다. 새 hard gate를 추가하려면 정적 검사와 테스트를 먼저 구현한 뒤 `deterministicRuleIds`에 등록해야 합니다.

### 회사 공통 자동 규칙

diff에서 직접 증명할 수 있는 규칙만 자동화합니다.

- `R-SEC-001`: `.env`, credentials, private key 계열 파일 커밋 금지
- `R-BYPASS-001`: 실행 가능한 파일의 `--no-verify`, `--no-gpg-sign` 자동 차단
- `R-VERIFY-001`: `|| true`, 미전파 `continue-on-error` 같은 검증 무시 경고
- `R-TEST-100`: 동작 변경에 대응하는 테스트 누락 경고
- `R-MACOS-001`: macOS `dd`는 `bs=1M` 사용
- `R-SCOPE-001`: 기능 변경과 관계없는 포맷팅·dead code 정리 혼합 방지
- `R-SIMP-001`: 단일 사용처나 가설적 미래 요구를 위한 과도한 추상화 방지
- `R-DRY-001`: 3회 미만 중복 또는 의미가 다른 흐름의 성급한 공통화 방지
- `R-SOC-001`: 한 모듈에 서로 다른 책임을 새로 결합하지 않기

사용자 확인 여부, dependency 승인, destructive operation 승인, 메모리 검증, 커밋 단위처럼 diff만으로 알 수 없는 항목은 회사 공통 문서의 `Human-only checks`에 남기며 AI가 위반을 추측하지 않습니다.

### 프로젝트 규칙 형식

```md
## Review Contract

### R-AUTH-001: Ownership validation is required

Severity: CRITICAL
Gate: error
Applies to:
- src/controllers/**
- src/services/**

Rule:
사용자별 데이터 접근 전에 소유권을 확인해야 합니다.

Violation examples:
- lessonId만으로 다른 사용자의 진도를 변경합니다.

Expected evidence:
- 변경된 API 또는 service 파일
- 누락된 소유권 검증 지점
```

## 모델 결과를 그대로 믿지 않는 이유

모델 응답은 최종 정책 결과가 아닙니다. 저장 전에 코드가 다음을 다시 검증합니다.

- 존재하는 resolved rule ID인지 확인
- `ruleTitle`, `severity`, `gate`를 실제 계약 값으로 교체
- PR 변경 파일인지 확인
- 규칙의 `Applies to` 범위인지 확인
- `overallRisk`와 `shouldBlockMerge` 재계산
- 제외된 응답을 `validationWarnings`와 PR 리포트에 기록

`R-SEC-001`의 민감 파일·명백한 literal secret과 `R-BYPASS-001`의 git bypass flag는 모델 호출 전에 TypeScript precheck가 직접 평가합니다. 차단 증거가 확인되면 provider를 호출하지 않고 바로 구조화 결과를 만듭니다.

`.env*`, npm/pypi credential 파일, credential JSON, private-key/keystore 계열 파일은 실제 diff 내용을 모델에 보내기 전에 redaction marker로 교체합니다. 일반 소스의 secret 대입, Bearer token, 주요 token 형태도 값만 가리며 모델 출력은 저장 전에 다시 scrub합니다. 이 기능은 전문 secret scanner를 대체하지 않습니다.

## 로컬 사용

```bash
npm ci
npm run build
npm test
```

Mock 리뷰:

```bash
AI_REVIEW_MOCK=1 npm run ai-review -- --diff-file demo/bad-change.patch
```

실제 provider 호출:

```bash
export GEMINI_API_KEY=...
export GEMINI_MODEL=<회사에서 승인한 모델 ID>
npm run ai-review -- --diff-file demo/bad-change.patch
```

`GEMINI_MODEL`은 의도적으로 기본값이 없습니다. preview 모델을 묵시적으로 선택하지 않고 회사에서 승인한 모델을 명시해야 합니다. 로컬 수동 실행에서는 승인된 proxy를 위해 `GEMINI_BASE_URL`을 설정할 수 있지만, 공용 reusable workflow는 API key destination을 caller가 바꾸지 못하도록 중앙 endpoint를 고정합니다.

생성 파일:

- `reports/review-result.json`
- `reports/review-report.md`

로컬 exit code:

| Exit code | 의미 |
|---:|---|
| `0` | 평가 완료, 또는 enforce가 꺼진 차단 후보 |
| `10` | `AI_REVIEW_ENFORCE=1`이고 정책 위반으로 BLOCKED |
| `2` | 입력, GitHub API, provider, schema 등 운영 오류 |

## 회사 GitHub Actions 적용

### 1. 중앙 레포 설정

사내 private/internal `ai-review-gate` 레포의 `Settings → Actions → General → Access`에서 조직 내 대상 레포가 action과 reusable workflow를 사용할 수 있게 허용합니다.

중앙 레포에서 사용하는 외부 GitHub Action은 mutable tag가 아니라 full commit SHA로 고정되어 있습니다.

### 2. 조직 secret과 variable

대상 레포를 선택해 다음 값을 제공합니다.

- Secret `AI_REVIEW_API_KEY`: 승인된 provider key
- Variable `GEMINI_MODEL`: 승인된 model ID
- 선택 Variable `AI_REVIEW_ENFORCE`: 처음에는 `0`, 안정화 후 `1`

`secrets: inherit`는 사용하지 않고 API key 하나만 named secret으로 전달합니다.

### 3. 대상 레포 caller

[caller 예시](examples/caller-workflow.yml)를 `.github/workflows/ai-review-gate.yml`로 복사한 뒤 `COMPANY`, 레포명, `FULL_COMMIT_SHA`를 실제 중앙 workflow commit SHA로 교체합니다.

핵심 호출부:

```yaml
jobs:
  review:
    permissions:
      contents: read
      pull-requests: read
      issues: write
    uses: COMPANY/ai-review-gate/.github/workflows/reusable-ai-review-gate.yml@FULL_COMMIT_SHA
    with:
      model: ${{ vars.GEMINI_MODEL }}
      enforce: false
      fail_on_tool_error: false
    secrets:
      ai_api_key: ${{ secrets.AI_REVIEW_API_KEY }}
```

### 4. 점진적 gate 적용

1. `enforce=false`, `fail_on_tool_error=false`로 comment-only 관찰
2. 20~30개 PR에서 오탐과 누락 확인
3. 팀이 승인한 `Gate: error` 규칙만 유지
   - AI-only error finding은 advisory이고 deterministic evaluator가 등록된 rule ID만 자동 차단
4. `enforce=true` 적용
5. 조직 Ruleset에서 `AI Review Gate / review` check를 required로 지정

정책 차단과 도구 장애는 분리됩니다.

- `decision=BLOCKED`, `failure_kind=policy`: `enforce=true`일 때만 check 실패
- `decision=NOT_EVALUATED`, `failure_kind=operational`: `enforce=true`이면 항상 fail-closed, comment-only에서는 `fail_on_tool_error=true`일 때 실패

검증에서 제외된 AI 항목과 유효한 blocker가 함께 있으면 유효한 blocker의 `BLOCKED` 결정을 유지하고 검증 경고를 함께 표시합니다. blocker 없이 검증 경고만 있으면 `NOT_EVALUATED`입니다.

## 입력 제한과 데이터 처리

기본 제한:

- PR diff: `500000` UTF-8 bytes
- 변경 파일: `200`개
- 프로젝트 contract path: 최대 `10`개, 저장소 내부 상대경로만 허용
- Review Gate job timeout: `10`분

한도를 넘으면 일부 diff만 보고 PASS하지 않고 `NOT_EVALUATED` 운영 오류로 처리합니다.

현재 provider 모드는 PR diff, resolved contract, 선택 CI context를 외부 Gemini-compatible endpoint로 보냅니다. 회사 코드 외부 전송, provider 보관 정책, region, quota 승인이 끝나기 전에는 실제 사내 레포에 적용하면 안 됩니다. build/test 원문은 secret-bearing Review Gate job에서 실행하거나 자동 첨부하지 않습니다.

## 구조

```text
contracts/company-global.md
  -> 회사 공통 executable rules + human-only checks

scripts/github-pull-request-input.ts
  -> GitHub API로 diff, changed files, base 계약 조회

scripts/deterministic-review.ts
  -> secret 및 git bypass error 규칙을 provider 호출 전에 직접 검사

scripts/parse-review-contract.ts
  -> 여러 계약 파싱, ordered override, 중복 ID 검증

scripts/normalize-review-result.ts
  -> 모델 결과를 실제 계약과 변경 파일 기준으로 재검증

scripts/sanitize-review-input.ts
  -> 민감 파일과 secret 형태의 입력/출력 redaction

.github/actions/ai-review-gate/action.yml
  -> 중앙 신뢰 코드만 실행하는 composite action

.github/workflows/reusable-ai-review-gate.yml
  -> artifact, comment, freshness, 최종 gate 정책

.github/workflows/ci.yml
  -> secret 없는 일반 build/test CI
```

GitHub Enterprise Server는 GitHub Cloud의 `$/` self reference를 지원하지 않습니다. GHES에서 사용할 때는 composite action을 별도 full SHA reference로 호출하도록 workflow를 조정해야 합니다.
