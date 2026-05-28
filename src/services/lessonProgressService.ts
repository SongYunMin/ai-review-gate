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

// 서비스는 AGENTS.md의 핵심 규칙을 보여주는 중심 계층입니다.
// 컨트롤러 대신 여기서 권한 확인, 멱등 처리, 트랜잭션 경계를 모두 결정합니다.
export class LessonProgressService {
  async completeLesson(input: CompleteLessonInput): Promise<CompleteLessonResult> {
    // 쓰기 전에 강의 존재 여부와 수강 권한을 먼저 확인해 사용자별 데이터 접근을 보호합니다.
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

      // 같은 완료 요청이 재시도되어도 코스 진도가 중복 증가하지 않도록 기존 결과를 반환합니다.
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
