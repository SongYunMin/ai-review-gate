# AGENTS.md

## 프로젝트 개요

이 저장소는 에듀테크 강의 완료 흐름을 보여주는 작은 Node.js TypeScript REST API 데모입니다.
AI Review Gate는 이 파일을 팀 컨벤션의 단일 기준으로 사용해야 합니다.

## 백엔드 아키텍처 규칙

- 컨트롤러는 얇게 유지해야 합니다.
- 비즈니스 로직은 서비스 클래스에 있어야 합니다.
- 컨트롤러에서 repository를 직접 호출하면 안 됩니다.
- 컨트롤러는 요청 데이터를 파싱하고 응답을 반환할 수 있지만, 흐름 판단은 서비스에 위임해야 합니다.
- Repository는 저장소 세부 구현을 감추어야 하며 요청/응답 로직을 포함하면 안 됩니다.

## 데이터 접근 규칙

- 사용자별 데이터 접근은 소유권 또는 수강 등록 여부를 검증해야 합니다.
- 강의 완료 처리는 요청 사용자가 해당 강의의 코스에 수강 등록되어 있는지 검증해야 합니다.
- 여러 테이블을 갱신하는 쓰기 작업은 트랜잭션을 사용해야 합니다.
- 재시도될 수 있는 API는 가능하면 멱등성을 가져야 합니다.

## API 오류 처리 규칙

- 내부 오류 메시지를 클라이언트에 노출하면 안 됩니다.
- 공개 API 오류는 안정적이고 사용자에게 안전한 메시지를 사용해야 합니다.
- 내부 오류 상세는 서버 측에서 로깅할 수 있지만 JSON 응답으로 반환하면 안 됩니다.

## 테스트 규칙

- 관련성이 있는 경우 권한 실패, 중복 요청, 트랜잭션 실패, 검증 실패 테스트를 추가해야 합니다.
- 사용자 진도에 영향을 주는 쓰기 API는 성공 경로 테스트만으로 충분하지 않습니다.
- 재시도 가능한 endpoint를 변경할 때는 멱등성 테스트를 포함해야 합니다.

## AI Review Gate 규칙

- PR diff를 리뷰할 때는 이 파일의 규칙을 먼저 기준으로 삼아야 합니다.
- 파일 경로와 라인 힌트가 있는 구체적인 지적 사항을 우선해야 합니다.
- diff에 보이지 않거나 diff에서 직접 추론되지 않는 지적 사항을 만들어내면 안 됩니다.
- 권한, 트랜잭션 무결성, 안전하지 않은 오류 노출에 영향을 주는 지적 사항은 머지 차단 후보로 취급해야 합니다.

## 발표 데모용 위반 작업 시나리오

아래 항목은 실제 구현 지시가 아니라, AI Review Gate가 어떤 변경을 Review Contract violation으로 판정하는지 보여주기 위한 의도적인 나쁜 변경 예시입니다.
실제 제품 코드에는 적용하지 마세요.

1. 강의 완료 API를 컨트롤러에서 직접 처리하는 변경
   - `src/controllers/lessonProgressController.ts`에서 service 호출을 제거하고 repository를 직접 import합니다.
   - `lessonId`만으로 완료 row를 생성하고, 요청 사용자의 코스 수강 등록 여부를 확인하지 않습니다.
   - 예상 감지 규칙: `R-ARCH-001`, `R-AUTH-001`

2. 강의 완료 저장과 진도 카운터 증가를 분리하고 내부 오류를 노출하는 변경
   - 강의 완료 row 생성 후 별도 원자성 없이 course progress 카운터를 증가시킵니다.
   - 실패 시 `error.message`를 그대로 JSON 응답에 포함합니다.
   - 예상 감지 규칙: `R-TX-001`, `R-ERR-001`

## Review Contract

아래 섹션은 사람이 읽는 팀 컨벤션이면서, AI Review Gate가 파싱하는 실행 가능한 Review Contract입니다.
각 규칙은 안정적인 rule ID, severity, gate action, 적용 경로, 판단 기준, 기대 증거를 포함해야 합니다.

### R-ARCH-001: Controllers must stay thin

Severity: HIGH
Gate: warning
Applies to:
- src/controllers/**

Rule:
컨트롤러는 요청 데이터를 파싱하고 응답을 반환하는 얇은 계층으로 유지해야 합니다.
비즈니스 판단, 권한 검증, 여러 저장소를 조합하는 흐름은 서비스 클래스에 위임해야 합니다.
컨트롤러에서 repository를 직접 호출하면 안 됩니다.

Violation examples:
- 컨트롤러 파일에서 repository를 직접 import하거나 생성합니다.
- 컨트롤러 안에서 소유권 확인 또는 여러 단계의 쓰기 흐름을 직접 구현합니다.
- 컨트롤러가 서비스 대신 도메인 상태 변경 순서를 결정합니다.

Expected evidence:
- 변경된 controller 파일 경로
- repository import 또는 controller 내부 비즈니스 흐름
- service 계층으로 위임할 수 있는 구체적인 지점

---

### R-AUTH-001: Ownership or enrollment validation is required

Severity: CRITICAL
Gate: error
Applies to:
- src/controllers/**
- src/services/**

Rule:
사용자별 학습 진도를 읽거나 쓰는 API는 데이터 접근 또는 변경 전에 소유권이나 코스 수강 등록 여부를 검증해야 합니다.
강의 완료 처리는 요청 사용자가 해당 강의의 코스에 수강 등록되어 있는지 확인한 뒤 진행해야 합니다.

Violation examples:
- lessonId만으로 강의를 완료하면서 인증 사용자의 코스 수강 여부를 확인하지 않습니다.
- userId 파라미터만 믿고 다른 사용자의 학습 진도를 반환합니다.
- 서비스 메서드가 소유권 확인 없이 repository 조회나 쓰기를 수행합니다.

Expected evidence:
- 변경된 API 경로 또는 service 메서드
- 누락된 소유권 또는 수강 등록 검증
- 검증을 추가해야 하는 controller/service 지점

---

### R-TX-001: Multi-write operations require transaction or explicit atomic boundary

Severity: HIGH
Gate: error
Applies to:
- src/services/**
- src/repositories/**

Rule:
하나의 사용자 요청으로 여러 테이블이나 여러 저장소 상태를 함께 갱신하는 쓰기 작업은 트랜잭션 또는 명시적인 원자적 경계를 가져야 합니다.
중간 실패 시 일부 상태만 반영되는 흐름을 만들면 안 됩니다.

Violation examples:
- 강의 완료 row를 생성한 뒤 별도 원자성 없이 코스 진도 카운터를 증가시킵니다.
- 첫 번째 쓰기 성공 후 두 번째 쓰기 실패를 되돌릴 방법이 없습니다.
- 여러 repository 쓰기를 서비스 밖에서 순차 호출합니다.

Expected evidence:
- 함께 변경되는 두 개 이상의 저장소 또는 테이블
- 트랜잭션, unit-of-work, atomic helper 부재
- 실패 시 불일치가 생길 수 있는 상태 조합

---

### R-IDEMP-001: Retriable write APIs should be idempotent

Severity: MEDIUM
Gate: warning
Applies to:
- src/controllers/**
- src/services/**
- src/repositories/**

Rule:
네트워크 재시도나 사용자 중복 클릭으로 반복될 수 있는 쓰기 API는 가능하면 멱등적으로 동작해야 합니다.
이미 처리된 요청은 중복 row나 중복 카운트 증가를 만들지 않고 기존 결과를 반환해야 합니다.

Violation examples:
- 같은 lessonId 완료 요청을 두 번 보내면 완료 row가 중복 생성됩니다.
- 이미 완료된 강의인데 course progress 카운터가 다시 증가합니다.
- 중복 요청을 감지할 키나 기존 상태 확인 없이 쓰기를 수행합니다.

Expected evidence:
- 재시도 가능한 write endpoint 또는 service 메서드
- 기존 상태 확인, unique key, upsert, idempotency key 부재
- 중복 요청 시 달라질 수 있는 응답 또는 저장 상태

---

### R-ERR-001: Internal error messages must not be exposed to clients

Severity: HIGH
Gate: error
Applies to:
- src/controllers/**
- src/app.ts
- src/errors/**

Rule:
공개 API 응답에는 안정적이고 사용자에게 안전한 오류 메시지만 포함해야 합니다.
내부 exception 메시지, stack trace, 저장소 구현 상세, 환경 정보는 JSON 응답으로 노출하면 안 됩니다.
내부 상세는 서버 측 로깅에서만 다룰 수 있습니다.

Violation examples:
- catch 블록에서 `error.message`를 그대로 응답 JSON에 넣습니다.
- 알 수 없는 내부 오류에 데이터베이스나 런타임 상세 메시지를 반환합니다.
- 예외 stack trace 또는 내부 class 이름을 API 응답에 포함합니다.

Expected evidence:
- 변경된 error handler 또는 controller catch 블록
- 클라이언트 응답에 포함되는 내부 오류 상세
- 안전한 공개 메시지로 치환할 지점

---

### R-TEST-001: Critical write APIs require failure-path tests

Severity: MEDIUM
Gate: warning
Applies to:
- tests/**
- src/controllers/**
- src/services/**

Rule:
사용자 진도에 영향을 주는 쓰기 API는 성공 경로 테스트만으로 충분하지 않습니다.
권한 실패, 중복 요청, 트랜잭션 실패, 검증 실패처럼 데이터 무결성과 직접 연결된 실패 경로 테스트를 함께 포함해야 합니다.

Violation examples:
- 강의 완료 API 변경에서 성공 응답만 검증합니다.
- 권한 실패 또는 수강 미등록 사용자의 요청을 테스트하지 않습니다.
- 중복 완료 요청이나 부분 쓰기 실패 시나리오가 빠져 있습니다.

Expected evidence:
- 변경된 critical write API 또는 관련 테스트 파일
- 누락된 실패 경로 테스트 종류
- 추가해야 할 구체적인 테스트 케이스
