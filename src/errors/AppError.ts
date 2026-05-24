// 클라이언트에 노출해도 되는 공개 메시지만 담는 애플리케이션 오류입니다.
// 내부 예외 메시지를 그대로 응답하지 않는 AGENTS.md 규칙을 데모에서 보여줍니다.
export class AppError extends Error {
  public readonly statusCode: number;

  public readonly publicMessage: string;

  constructor(statusCode: number, publicMessage: string) {
    super(publicMessage);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}
