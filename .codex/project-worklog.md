# Project Worklog

## 메타데이터

- 프로젝트: ai-review-gate
- 경로: /Users/knowre-yunmin/ai-review-gate
- 최초 생성: 2026-08-20 16:30:10 KST
- 마지막 업데이트: 2026-08-20 17:48:38 KST

## 현재 요청

- 회사 공통 개발 원칙을 실행 가능한 Review Contract로 만들고, 여러 사내 레포에서 안전하게 재사용할 수 있는 GitHub Actions PR Review Gate로 운영 수준을 높인다.

## 현재 상태

- 회사 공통 계약 9개 규칙과 human-only checks를 분리해 추가했고, base SHA의 프로젝트 계약이 ordered rule ID override로 우선한다.
- GitHub API로 PR diff, 변경 파일, base 계약만 읽는 composite action과 reusable workflow를 추가했으며 PR head checkout과 실행을 제거했다.
- 모델 결과의 rule ID, source, severity, gate, changed file, Applies to, enforcement, overall risk, merge decision을 코드에서 재검증한다.
- 일반 build/test는 secret 없는 별도 CI workflow로 분리했고 정책 차단과 운영 오류의 출력 및 exit code를 구분한다.
- 현재 브랜치는 `feature/more-review-contract-violations`이며 사용자 변경 `.gitignore`는 보존 대상이다.

## 중요 결정 사항

### 2026-08-20

- 2026-08-20 16:30:47 KST: 회사 공통 계약은 중앙 action에 포함하고, base SHA의 프로젝트 계약을 입력 순서대로 합쳐 같은 rule ID는 더 좁은 프로젝트 계약이 덮어쓰도록 결정
- 2026-08-20 16:30:47 KST: PR head 코드는 실행하거나 checkout하지 않고 GitHub API로 diff와 base 계약 문서만 읽는 composite action + reusable workflow 구조를 채택
- 2026-08-20 16:30:47 KST: 새 dependency 없이 기존 TypeScript, OpenAI SDK, Zod, Vitest를 유지하고 코드 변경은 TDD로 진행
- 2026-08-20 17:05:23 KST: `Gate: off`는 모델 입력과 정규화 결과에서 제외하고, 유효한 policy blocker는 validation warning보다 우선하도록 결정
- 2026-08-20 17:05:23 KST: diff로 입증할 수 없는 dependency/destructive approval 등은 AI가 추측하지 않고 human-only checks와 별도 Ruleset/승인 통제에 남기기로 결정
- 2026-08-20 17:05:23 KST: GitHub Cloud의 `$/` self reference를 사용해 called workflow와 action commit을 일치시키며 GHES는 별도 full SHA action 참조가 필요하다고 문서화
- 2026-08-20 17:40:37 KST: 사용자가 정의한 `Gate: error`는 보존하고, matching deterministic evidence가 있는 finding만 `Enforcement: deterministic` 자동 차단으로 인정하며 AI-only finding은 `Enforcement: advisory`로 표시하기로 결정
- 2026-08-20 17:40:37 KST: enforce 모드는 provider, 입력, comment, artifact 등 운영 오류도 fail-closed하고 comment-only 모드만 선택적 fail-open을 허용
- 2026-08-20 17:40:37 KST: provider endpoint는 caller input에서 제거하고 중앙 코드에 고정하며, contract/diff/CI context와 모델 출력에 공통 secret scrub을 적용

## 최근 작업 타임라인

### 2026-08-20

- 2026-08-20 16:30:47 KST: 기존 repo-local workflow를 그대로 복사하는 방식은 규약 우회, secret-bearing job의 PR 코드 실행, 운영 오류와 정책 차단 혼동 때문에 폐기하고 중앙 실행 코드와 대상 PR 데이터를 분리하는 방향으로 전환
- 2026-08-20 17:05:23 KST: TDD로 계약 병합, 모델 결과 정규화, GitHub API base 입력, 크기/경로 제한, 민감 diff redaction, Action 정적 계약을 구현
- 2026-08-20 17:05:23 KST: 요구사항 리뷰에서 off 규칙 미비, 민감 경로 불일치, workflow output 불일치, LOW confidence 집계, 계약 필수 필드 누락을 발견해 회귀 테스트와 함께 수정
- 2026-08-20 17:05:23 KST: validation warning이 유효한 blocker까지 fail-open으로 강등하는 문제를 재리뷰에서 발견하고 policy blocker 우선순위로 수정
- 2026-08-20 17:40:37 KST: 보안 리뷰에서 prompt omission, secret 재노출, endpoint 변경, operational fail-open을 발견해 deterministic precheck, 입출력 scrub, endpoint 고정, enforce fail-closed로 보완
- 2026-08-20 17:40:37 KST: deterministic hard gate가 파일 삭제, 일반 식별자, 동적 token 조회, 주석을 차단하던 false positive를 재현하고 new-file/added-line/강한 literal 형태/실행 문맥 기준으로 좁힘

## 최근 변경 파일

- `.codex/project-worklog.md`
- `.github/actions/ai-review-gate/action.yml`
- `.github/workflows/ai-review-gate.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/reusable-ai-review-gate.yml`
- `contracts/company-global.md`
- `scripts/ai-review.ts`
- `scripts/build-review-prompt.ts`
- `scripts/deterministic-review.ts`
- `scripts/github-pull-request-input.ts`
- `scripts/normalize-review-result.ts`
- `scripts/parse-review-contract.ts`
- `scripts/render-review-report.ts`
- `scripts/review-exit-code.ts`
- `scripts/sanitize-review-input.ts`
- `schemas/review-result.schema.ts`
- `prompts/code-review-system.md`
- `tests/*.test.ts` 관련 계약/CLI/Action 테스트
- `AGENTS.md`
- `README.md`
- `docs/local-test-guide.md`
- `docs/ai_review_gate_project_summary_and_codex_prompt.md`
- `docs/plans/2026-08-20-company-review-gate-design.md`
- `docs/plans/2026-08-20-company-review-gate-implementation.md`
- `examples/caller-workflow.yml`

## 검증

- 현재 로컬 기준 Node.js 22.21.0, npm 10.9.4를 확인했다.
- TypeScript build와 전체 Vitest 73개가 변경 후 통과했다.
- workflow/action YAML 파싱과 actionlint 검사를 수행했다. actionlint 1.7.12는 GitHub Cloud의 신규 `$/` 문법을 아직 인식하지 못해 공식 지원 문법 두 건만 명시적으로 제외하고 나머지 검사를 통과했다.
- mock comment-only는 exit 0으로 BLOCKED 후보 리포트를 만들고, enforce 모드는 exit 10으로 정책 차단하는 것을 확인했다.
- mock 결과에서 `R-BYPASS-001`은 deterministic 차단, `R-AUTH/R-TX/R-ERR`는 원래 error gate를 보존한 advisory finding으로 분리되는 것을 확인했다.
- 커밋 전 검사에서 실제 secret은 없었고, push protection이 오인할 수 있는 완성형 가짜 PAT 문자열도 소스에 남기지 않았다.

## 리스크 및 확인 필요

- PR diff와 계약 내용은 외부 Gemini endpoint로 전송되므로 회사 보안 및 데이터 처리 승인이 별도로 필요하다.
- GitHub Cloud의 self repository reference(`$/`)를 사용할 예정이며 GitHub Enterprise Server는 별도 remote action ref 구성이 필요하다.
- 외부 fork PR 지원은 안전한 `pull_request_target` 사용 조건을 지켜야 하며 head checkout 또는 실행이 추가되면 즉시 위험해진다.
- 실제 GitHub Actions run과 실제 provider 호출은 아직 실행하지 않았으며, 대상 조직 secret/variable과 중앙 private repo Access 설정이 필요하다.
- 현재 개인 원격 저장소에는 `GEMINI_MODEL` variable이 없어 새 workflow를 실제 실행하기 전에 승인된 model ID 설정이 필요하다.
- 내장 secret 탐지는 명백한 파일명과 강한 token/literal 패턴을 보수적으로 가리는 방어층이며 전문 secret scanner를 대체하지 않는다.
- AI-only error finding은 원래 Gate를 보존하지만 자동 차단하지 않으므로 사람 리뷰와 별도 deterministic CI가 계속 필요하다.

## 다음 액션

- 회사 조직 중앙 레포의 Actions Access, selected repository secret, 승인 model variable을 설정한다.
- 첫 대상 레포에서 immutable workflow SHA로 comment-only PR run을 실행해 실제 comment/artifact/status를 확인한다.
- 20~30개 PR의 오탐/누락을 검토한 뒤 enforce와 required check 적용 여부를 결정한다.
