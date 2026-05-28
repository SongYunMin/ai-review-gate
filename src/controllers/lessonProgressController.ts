import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { createCourseProgressRepository } from '../repositories/courseProgressRepository';
import { createLessonProgressRepository } from '../repositories/lessonProgressRepository';

const completeLessonParamsSchema = z.object({
  lessonId: z.string().min(1),
});

// 컨트롤러는 HTTP 입력을 검증하고 응답 형태만 결정합니다.
// 수강 권한, 멱등성, 트랜잭션 같은 업무 규칙은 서비스 계층에서 처리합니다.
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
    const lessonRepository = createLessonProgressRepository();
    const courseRepository = createCourseProgressRepository();
    const lesson = lessonRepository.findLessonById(lessonId);

    // 발표용 위반: 컨트롤러가 서비스 대신 저장소를 직접 조합하고 수강 등록 검증 없이 쓰기를 수행합니다.
    const progress = lessonRepository.createCompletion({
      userId,
      lessonId,
      completedAt: new Date(),
    });

    // 발표용 위반: 완료 row와 코스 진도 업데이트를 트랜잭션 없이 순차 실행해 부분 반영 가능성을 만듭니다.
    const courseProgress = courseRepository.incrementCompletedLessonCount({
      userId,
      courseId: lesson!.courseId,
    });

    res.status(200).json({
      ok: true,
      progress,
      courseProgress,
    });
  } catch (error) {
    // 발표용 위반: 내부 exception message를 그대로 클라이언트 응답으로 노출합니다.
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : '알 수 없는 내부 오류입니다.',
      },
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
