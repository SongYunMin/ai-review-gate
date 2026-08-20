# 회사 공통 AI Review Contract

이 문서는 회사 레포에 공통으로 적용되는 최소 Review Contract다. 프로젝트의 base 브랜치에 있는 더 좁은 계약이 같은 rule ID를 선언하면 프로젝트 규칙이 이 규칙을 전체 교체한다.

AI Review Gate는 PR diff에서 직접 확인할 수 있는 증거만 자동 판정한다. 사용자 확인 여부, 승인 기록, 에이전트의 작업 과정처럼 diff만으로 알 수 없는 항목은 이 문서 하단의 human-only checks로 남기고 위반을 만들어내지 않는다.

## Review Contract

### R-SEC-001: Sensitive configuration files must not be committed

Severity: CRITICAL
Gate: error
Applies to:
- **

Rule:
`.env.example`이나 명백한 placeholder fixture를 제외하고 실제 환경 설정, 자격 증명, private key 또는 비밀값을 저장소에 추가하면 안 됩니다.
비밀값을 발견해도 evidence나 리포트에 원문을 반복하지 말고 파일 경로와 마스킹된 키 이름만 제시해야 합니다.

Violation examples:
- `.env` 또는 `credentials.json` 파일을 새로 추가합니다.
- example 파일에 실제 토큰, private key 또는 접속 비밀번호를 넣습니다.
- 일반 소스나 workflow에 실제 token, password 또는 client secret literal을 추가합니다.

Expected evidence:
- 추가되거나 변경된 민감 파일 경로
- 비밀값을 재출력하지 않은 마스킹된 키 이름
- example 또는 안전한 fixture로 볼 수 없는 구체적인 이유

---

### R-BYPASS-001: Git verification and signing flags must not be bypassed

Severity: HIGH
Gate: error
Applies to:
- .github/workflows/**
- scripts/**
- **/*.sh
- package.json
- Makefile

Rule:
실행 가능한 workflow나 script에 `--no-verify` 또는 `--no-gpg-sign`를 추가해 git hook이나 signing을 자동 우회하면 안 됩니다.

Violation examples:
- `git commit --no-verify` 또는 `git commit --no-gpg-sign`를 자동화에 추가합니다.

Expected evidence:
- 우회 플래그가 추가된 실행 가능한 파일과 줄
- 우회되는 hook 또는 signing 단계

---

### R-VERIFY-001: Verification failures must not be silently ignored

Severity: HIGH
Gate: warning
Applies to:
- .github/workflows/**
- scripts/**
- **/*.sh
- package.json
- Makefile
- docs/**
- README*

Rule:
hook, test 또는 validation 실패를 `|| true`나 미전파 `continue-on-error`로 조용히 무시하면 안 됩니다.
실패를 수집하기 위한 `continue-on-error`는 뒤에서 같은 실패를 명시적으로 다시 전파할 때만 허용됩니다.

Violation examples:
- 필수 테스트를 `|| true`로 감싸고 이후 실패를 전파하지 않습니다.
- 검증 step에 `continue-on-error`를 추가하고 결과 확인 없이 workflow를 성공시킵니다.

Expected evidence:
- 실패 무시가 추가된 정확한 파일과 줄
- 우회되는 hook, test 또는 validation 단계
- 이후 실패를 다시 전파하는 경계가 없다는 diff 근거

---

### R-TEST-100: Behavior changes require related test changes

Severity: MEDIUM
Gate: warning
Applies to:
- src/**
- app/**
- packages/**
- lib/**
- tests/**
- test/**
- __tests__/**

Rule:
외부 동작, 분기, 검증 또는 상태 변경을 수정한 PR은 관련 정상 흐름이나 실패 흐름 테스트를 함께 추가하거나 수정해야 합니다.
기존 전체 테스트 통과 여부는 별도 deterministic CI가 책임지며, AI는 diff에 보이는 테스트 누락만 지적합니다.

Violation examples:
- 입력 검증 분기를 추가했지만 해당 정상 또는 실패 테스트가 전혀 바뀌지 않습니다.
- 사용자 상태를 변경하는 로직을 수정했지만 회귀 테스트가 없습니다.

Expected evidence:
- 동작이 달라진 구체적인 프로덕션 코드
- 관련 테스트 파일 변경이 없다는 diff 근거
- 추가해야 할 구체적인 테스트 시나리오

---

### R-MACOS-001: macOS dd block size must use uppercase M

Severity: LOW
Gate: warning
Applies to:
- **/*.sh
- .github/workflows/**
- docs/**
- README*

Rule:
macOS에서 실행되는 `dd` 명령의 블록 크기는 소문자 `m`이 아니라 대문자 `M`을 사용해야 합니다.
Linux 전용 실행이라고 diff에서 확인되는 경우에는 위반으로 보고하면 안 됩니다.

Violation examples:
- macOS용 스크립트에 `dd ... bs=1m`을 추가합니다.

Expected evidence:
- 잘못된 `dd` 명령이 추가된 파일과 줄
- macOS 실행 맥락을 보여주는 diff 근거

---

### R-SCOPE-001: Refactoring and behavior changes must stay surgically scoped

Severity: MEDIUM
Gate: warning
Applies to:
- **

Rule:
기능 또는 버그 수정과 관계없는 대규모 포맷팅, 이름 변경, 기존 dead code 정리를 같은 변경에 섞으면 안 됩니다.
PR 목적을 알 수 없으면 범위 밖이라고 추측하지 말고 diff 자체에서 서로 독립적인 변경 묶음이 명확할 때만 보고합니다.

Violation examples:
- 한 API 수정과 동시에 관계없는 디렉터리 전체를 포맷팅합니다.
- 요청 기능과 독립적인 기존 dead code를 여러 파일에서 함께 삭제합니다.

Expected evidence:
- 서로 독립적으로 분리 가능한 두 변경 묶음
- 동작 변경과 무관한 구체적인 파일 또는 줄
- 별도 PR로 분리할 수 있는 명확한 경계

---

### R-SIMP-001: Avoid speculative or single-use abstractions

Severity: MEDIUM
Gate: warning
Applies to:
- src/**
- app/**
- packages/**
- lib/**

Rule:
현재 요구 없이 미래 확장만을 위해 factory, interface, wrapper 또는 generic framework를 추가하거나 한 번만 쓰는 로직을 불필요하게 추상화하면 안 됩니다.
사용처와 변형점이 diff에서 충분히 확인되지 않으면 위반으로 보고하지 않습니다.

Violation examples:
- 구현체와 호출부가 각각 하나뿐인데 factory, interface, registry 계층을 동시에 추가합니다.
- 한 줄로 끝나는 처리를 여러 wrapper와 strategy로 나눕니다.

Expected evidence:
- 새 추상화와 diff에서 확인되는 실제 사용 위치
- 현재 제공하는 구체적인 변형점 수
- 같은 동작을 더 단순하게 표현할 수 있는 대안

---

### R-DRY-001: Do not extract premature or forced shared abstractions

Severity: LOW
Gate: warning
Applies to:
- src/**
- app/**
- packages/**
- lib/**

Rule:
두 번 이하의 유사 코드나 의미가 다른 로직을 억지로 공통화해 조건 분기와 결합도를 높이면 안 됩니다.
사용처를 충분히 확인할 수 없으면 위반으로 보고하지 않습니다.

Violation examples:
- 서로 달라져야 할 두 흐름을 옵션 플래그가 많은 공용 함수로 합칩니다.
- 중복 두 곳만 보고 의미가 다른 로직을 하나의 helper로 강제합니다.

Expected evidence:
- 공통화된 원래 흐름과 새 공용 함수
- 새 함수에 늘어난 조건 분기 또는 옵션
- 두 흐름의 책임이 달라져야 하는 구체적인 근거

---

### R-SOC-001: Changed modules must retain a cohesive responsibility

Severity: MEDIUM
Gate: warning
Applies to:
- src/**
- app/**
- packages/**
- lib/**

Rule:
변경된 함수나 모듈이 요청 파싱, 도메인 판단, 저장, 외부 I/O처럼 서로 다른 책임을 새로 한곳에서 맡게 하면 안 됩니다.
원칙 이름만 나열하지 말고 실제로 섞인 책임과 위임 지점을 제시해야 합니다.

Violation examples:
- 서비스 메서드에 HTTP 응답 생성과 파일 저장 책임을 함께 추가합니다.
- 컨트롤러가 도메인 판단과 여러 저장소 쓰기 순서를 직접 결정합니다.

Expected evidence:
- 변경 전후 책임의 구체적인 차이
- 한곳에 새로 섞인 두 개 이상의 관심사
- 기존 계층이나 모듈로 위임할 수 있는 지점

## Human-only checks

다음 기준은 회사 공통 작업 원칙이지만 PR diff만으로 사실을 증명할 수 없으므로 AI 위반으로 자동 생성하지 않는다.

- 사용자의 명시적 구현 요청 전에 파일을 변경했는지, 설명 요청에 임의 구현했는지
- 맥락이 결과를 바꿀 때 질문했는지, 안전한 읽기 전용 조사를 먼저 했는지
- dependency 추가, 스택 변경, migration, 공용 API 변경, 패키지 추출에 사람 합의가 있었는지
- 새 코드를 만들기 전에 레포의 기존 util, 모듈, 팀 표준 라이브러리와 컨벤션을 확인했는지
- 새 dependency가 현재 요구에 꼭 필요하고 회사가 허용한 안정 버전인지
- 프로덕션 변경을 spike나 demo-first 수준으로 끝내지 않고 관련 테스트와 팀 리뷰 대상으로 만들었는지
- 범위를 줄일 때 기능 완결성을 낮추지 않고 독립적인 기능 단위로 잘랐는지
- force push, hard reset, 배포, 외부 서비스 호출, 운영 데이터 변경 전에 대상을 확인했는지
- 과거 메모리의 파일, 함수, 플래그를 현재 레포에서 다시 확인했는지
- Homebrew `/opt/homebrew/bin/rg`와 실제 런타임 버전을 확인했는지
- 커밋 전에 사용자 승인을 받았는지
- 이슈 하나를 논리적으로 하나의 커밋으로 분리하고 `closes #N`을 사용했는지

이 항목은 AI 에이전트 지침, CODEOWNERS, Ruleset, GitHub Environment, commit metadata 검사처럼 해당 사실을 관찰할 수 있는 별도 통제에서 다뤄야 한다.
