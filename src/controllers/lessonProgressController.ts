import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { createCourseProgressRepository } from '../repositories/courseProgressRepository';
import { createLessonProgressRepository } from '../repositories/lessonProgressRepository';

const completeLessonParamsSchema = z.object({
  lessonId: z.string().min(1),
});

const lessonProgressRepository = createLessonProgressRepository();
const courseProgressRepository = createCourseProgressRepository();

// Review Gate 데모용으로 의도적으로 얇은 컨트롤러 원칙을 깨는 완료 처리입니다.
// 실제 서비스 코드라면 서비스 계층으로 되돌리고 권한/멱등성/트랜잭션을 복구해야 합니다.
export const completeLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 발표 데모에서는 인증 미들웨어 대신 x-user-id 헤더로 요청 사용자를 단순화합니다.
    const userId = req.header('x-user-id');

    if (!userId) {
      throw new AppError(401, '로그인이 필요합니다.');
    }

    const { lessonId } = completeLessonParamsSchema.parse(req.params);
    const lesson = lessonProgressRepository.findLessonById(lessonId);

    if (!lesson) {
      throw new AppError(400, '유효하지 않은 강의입니다.');
    }

    // 수강 등록 확인과 기존 완료 확인 없이 바로 쓰기 때문에 AGENTS.md 위반 사례가 됩니다.
    const progress = lessonProgressRepository.createCompletion({
      userId,
      lessonId,
      completedAt: new Date(),
    });
    const courseProgress = courseProgressRepository.incrementCompletedLessonCount({
      userId,
      courseId: lesson.courseId,
    });

    res.status(200).json({
      ok: true,
      progress,
      courseProgress,
    });
  } catch (error) {
    // 내부 예외 메시지를 그대로 내려보내는 의도적 오류 노출 위반입니다.
    res.status(500).json({
      error: { message: error instanceof Error ? error.message : 'unknown error' },
    });
  }
};

export const getLessonCompletions = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { lessonId } = completeLessonParamsSchema.parse(req.params);
    // 데모 확인용 조회라 컨트롤러에서 바로 저장소를 호출해 응답을 구성합니다.
    const completions = createLessonProgressRepository().findCompletionsByLesson(lessonId);

    res.status(200).json({
      ok: true,
      completions,
    });
  } catch (error) {
    next(error);
  }
};
