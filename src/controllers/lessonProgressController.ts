import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { lessonProgressService } from '../services/lessonProgressService';

const completeLessonParamsSchema = z.object({
  lessonId: z.string().min(1),
});

export const completeLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.header('x-user-id');

    if (!userId) {
      throw new AppError(401, '로그인이 필요합니다.');
    }

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
