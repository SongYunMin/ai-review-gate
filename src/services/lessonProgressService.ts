import { AppError } from '../errors/AppError';
import { createCourseProgressRepository } from '../repositories/courseProgressRepository';
import {
  createLessonProgressRepository,
  runLessonProgressTransaction,
} from '../repositories/lessonProgressRepository';
import type { CourseProgress, LessonProgress } from '../repositories/demoDatabase';

export type CompleteLessonInput = {
  userId: string;
  lessonId: string;
};

export type CompleteLessonResult = {
  progress: LessonProgress;
  courseProgress: CourseProgress;
};

export class LessonProgressService {
  async completeLesson(input: CompleteLessonInput): Promise<CompleteLessonResult> {
    const lessonRepository = createLessonProgressRepository();
    const lesson = lessonRepository.findLessonById(input.lessonId);

    if (!lesson) {
      throw new AppError(400, '유효하지 않은 강의입니다.');
    }

    if (!lessonRepository.isUserEnrolledInCourse(input.userId, lesson.courseId)) {
      throw new AppError(403, '강의 수강 권한이 없습니다.');
    }

    return runLessonProgressTransaction(async (transactionDatabase) => {
      // 완료 처리와 코스 진도 업데이트는 같은 트랜잭션 데이터에서 실행합니다.
      const transactionLessonRepository = createLessonProgressRepository(transactionDatabase);
      const transactionCourseRepository = createCourseProgressRepository(transactionDatabase);
      const existingProgress = transactionLessonRepository.findCompletion(
        input.userId,
        input.lessonId,
      );

      if (existingProgress) {
        return {
          progress: existingProgress,
          courseProgress: transactionCourseRepository.getUserCourseProgress(
            input.userId,
            lesson.courseId,
          ),
        };
      }

      const progress = transactionLessonRepository.createCompletion({
        userId: input.userId,
        lessonId: input.lessonId,
        completedAt: new Date(),
      });
      const courseProgress = transactionCourseRepository.incrementCompletedLessonCount({
        userId: input.userId,
        courseId: lesson.courseId,
      });

      return { progress, courseProgress };
    });
  }
}

export const lessonProgressService = new LessonProgressService();
