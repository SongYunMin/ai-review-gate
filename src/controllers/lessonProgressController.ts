import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { lessonProgressService } from '../services/lessonProgressService';

const completeLessonParamsSchema = z.object({
  lessonId: z.string().min(1),
});

const readUserId = (req: Request): string => {
  // 발표 데모에서는 인증 미들웨어 대신 x-user-id 헤더로 요청 사용자를 단순화합니다.
  const userId = req.header('x-user-id');

  if (!userId) {
    throw new AppError(401, '로그인이 필요합니다.');
  }

  return userId;
};

// 컨트롤러는 HTTP 입력을 검증하고 응답 형태만 결정합니다.
// 수강 권한, 멱등성, 트랜잭션 같은 업무 규칙은 서비스 계층에서 처리합니다.
export const completeLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = readUserId(req);
    const { lessonId } = completeLessonParamsSchema.parse(req.params);
    const result = await lessonProgressService.completeLesson({ userId, lessonId });

    res.status(200).json({
      ok: true,
      progress: result.progress,
      courseProgress: result.courseProgress,
    });
  } catch (error) {
    next(error);
  }
};

export const getLessonCompletions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = readUserId(req);
    const { lessonId } = completeLessonParamsSchema.parse(req.params);
    const completions = await lessonProgressService.getLessonCompletions({ userId, lessonId });

    res.status(200).json({
      ok: true,
      completions,
    });
  } catch (error) {
    next(error);
  }
};
