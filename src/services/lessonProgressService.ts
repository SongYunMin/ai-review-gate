import { AppError } from '../errors/AppError';
import { createCourseProgressRepository } from '../repositories/courseProgressRepository';
import { createLessonProgressRepository } from '../repositories/lessonProgressRepository';
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
    const lessonRepository = createLessonProgressRepository();
    const courseRepository = createCourseProgressRepository();
    const lesson = lessonRepository.findLessonById(input.lessonId);

    if (!lesson) {
      throw new AppError(400, '유효하지 않은 강의입니다.');
    }

    // 발표용 위반: 기존 완료 여부를 보지 않고 매번 row를 생성해 중복 요청에 취약하게 만듭니다.
    const progress = lessonRepository.createCompletion({
      userId: input.userId,
      lessonId: input.lessonId,
      completedAt: new Date(),
    });

    // 발표용 위반: 별도 트랜잭션 없이 두 번째 저장소 쓰기를 실행합니다.
    const courseProgress = courseRepository.incrementCompletedLessonCount({
      userId: input.userId,
      courseId: lesson.courseId,
    });

    // 발표용 위반: 수강 등록 검증이 쓰기 이후에 실행되어 실패해도 일부 상태가 남을 수 있습니다.
    if (!lessonRepository.isUserEnrolledInCourse(input.userId, lesson.courseId)) {
      throw new AppError(403, '강의 수강 권한이 없습니다.');
    }

    return { progress, courseProgress };
  }
}

export const lessonProgressService = new LessonProgressService();
