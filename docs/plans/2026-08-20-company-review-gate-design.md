# Company AI Review Gate Design

## 목표와 범위

회사 공통 개발 원칙을 중앙 Review Contract로 제공하고, 각 레포의 base 브랜치에 있는 프로젝트 Review Contract가 더 좁은 규칙으로 우선하도록 한다. PR 코드는 실행하지 않고 diff를 데이터로만 읽어 AI 판정 결과를 구조화한 뒤 PR 리포트와 merge check로 제공한다.

이 기능은 PR CI gate다. 빌드, 테스트, 배포는 별도 workflow가 책임지며 AI gate가 대체하지 않는다. 1차 지원 범위는 GitHub Cloud의 private/internal 레포다.

## 선택한 구조

세 가지 방식을 비교했다.

1. workflow 파일 복사: 가장 빠르지만 레포별 drift와 secret 경계 문제가 남는다.
2. reusable workflow + composite action: 중앙 정책과 실행 코드를 함께 버전 고정할 수 있고 각 레포에는 짧은 caller만 남는다.
3. GitHub App: fork와 조직 전체 운영에는 가장 강하지만 별도 서버, webhook, key 운영이 필요하다.

현재 범위에는 2번을 채택한다. reusable workflow는 job, 권한, 리포트, 최종 check를 정의한다. composite action은 중앙 레포의 신뢰된 TypeScript CLI만 설치·실행한다. GitHub Cloud의 `$/` self reference를 사용해 reusable workflow와 action이 같은 commit에서 실행되게 한다.

## 데이터 흐름과 신뢰 경계

1. caller workflow는 `pull_request_target`에서 base 브랜치의 고정된 workflow를 실행한다.
2. 중앙 action은 PR head를 checkout하지 않는다.
3. GitHub API에서 PR diff와 base SHA의 `AGENTS.md`, `CLAUDE.md`를 읽는다.
4. 중앙의 회사 공통 계약을 먼저 로드하고 프로젝트 계약을 입력 순서대로 병합한다.
5. 같은 rule ID가 있으면 뒤의 프로젝트 규칙이 앞의 공통 규칙을 덮어쓴다.
6. 모델에는 계약 문서와 diff가 실행 명령이 아닌 신뢰하지 않는 데이터임을 명시한다.
7. 모델 결과의 rule ID를 실제 계약과 대조하고 title, severity, gate는 계약 값으로 정규화한다.
8. 변경 파일에 없는 지적과 알 수 없는 rule ID는 차단 근거에서 제외하고 검증 경고로 남긴다.
9. `shouldBlockMerge`와 overall risk는 정규화된 결과에서 코드가 다시 계산한다.

## 오류와 gate 정책

- 정책 차단: 정규화된 `gate=error`, `confidence>=MEDIUM` 위반이 있을 때 `blocked` 상태를 낸다.
- `gate=error`의 계약 의도는 보존하되, matching deterministic evidence가 없는 finding은 advisory로 표시하고 자동 차단에서 제외한다.
- 운영 오류: API key, provider, schema, GitHub API, diff 크기 문제는 `error` 상태로 분리한다.
- reusable workflow는 `enforce`가 켜진 정책 차단만 기본 실패 처리한다.
- enforce 모드의 운영 오류는 항상 fail-closed하며, comment-only 모드만 `fail_on_tool_error`로 실패 여부를 선택한다.
- diff는 기본 500 KiB로 제한하며 초과 시 임의 축약이나 부분 PASS 대신 운영 오류로 보고한다.

## 회사 공통 규칙의 자동화 범위

diff에서 증거를 확인할 수 있는 최소 규칙만 자동화한다.

- 요청 범위 밖 변경과 불필요한 대규모 리팩터링
- 단순 문제에 대한 과도한 추상화
- 변경 동작에 대응하는 테스트 누락
- `.env`, credentials, private key 등 민감 파일 추가
- hook 우회 플래그의 자동화 스크립트 도입
- 한 모듈에 서로 다른 변경 책임을 결합
- macOS `dd`에서 잘못된 `bs=1m` 사용

사용자와의 확인 여부, destructive operation 승인, 새 dependency 도입 합의, 실제 승인 기록, 메모리 검증, 커밋당 이슈 수처럼 diff만으로 증명할 수 없는 항목은 human-only checks로 문서화하고 자동 위반을 만들지 않는다. 해당 메타데이터를 신뢰할 수 있게 제공하는 별도 통제가 생기기 전에는 승인 부재를 추측하지 않는다.

## 검증 전략

- 계약 병합과 override 단위 테스트
- 모델 결과 canonicalization과 unknown rule/unchanged file 제거 테스트
- GitHub API가 base SHA 계약만 읽고 404 문서는 건너뛰는 테스트
- diff 크기 제한 테스트
- 정책 차단과 운영 오류 상태 분리 테스트
- action/workflow 파일이 head checkout과 target npm script를 포함하지 않는 정적 테스트
- 기존 전체 테스트와 TypeScript build
