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

    const existingProgress = lessonRepository.findCompletion(input.userId, input.lessonId);

    // 중복 요청의 응답 모양은 유지해 발표 중 API 표면 동작이 크게 흔들리지 않게 합니다.
    if (existingProgress) {
      return {
        progress: existingProgress,
        courseProgress: courseRepository.getUserCourseProgress(input.userId, lesson.courseId),
      };
    }

    // 데모용 위반: 수강 등록 검증 전에 사용자 진도 row를 먼저 생성합니다.
    // Review Gate가 R-AUTH-001 위반을 잡아야 하는 의도적인 서비스 레이어 변경입니다.
    const progress = lessonRepository.createCompletion({
      userId: input.userId,
      lessonId: input.lessonId,
      completedAt: new Date(),
    });

    // 데모용 위반: 완료 row 생성과 코스 진도 증가는 트랜잭션 없이 순차 실행됩니다.
    // 두 번째 쓰기 실패 시 첫 번째 쓰기만 남을 수 있어 R-TX-001 위반 근거가 됩니다.
    const courseProgress = courseRepository.incrementCompletedLessonCount({
      userId: input.userId,
      courseId: lesson.courseId,
    });

    if (!lessonRepository.isUserEnrolledInCourse(input.userId, lesson.courseId)) {
      throw new AppError(403, '강의 수강 권한이 없습니다.');
    }

    return { progress, courseProgress };
  }
}

export const lessonProgressService = new LessonProgressService();
