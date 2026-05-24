import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { completeLesson } from './controllers/lessonProgressController';
import { AppError } from './errors/AppError';

export const app = express();

app.use(express.json());

// 데모 API의 단일 진입점입니다. 컨트롤러가 요청 파싱을 맡고 실제 완료 흐름은 서비스로 위임합니다.
app.post('/api/lessons/:lessonId/complete', completeLesson);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // 클라이언트에는 합의된 공개 메시지만 내려 내부 구현 세부사항 노출을 막습니다.
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { message: error.publicMessage } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: { message: '요청 형식이 올바르지 않습니다.' } });
    return;
  }

  res.status(500).json({ error: { message: '서버 오류가 발생했습니다.' } });
});
