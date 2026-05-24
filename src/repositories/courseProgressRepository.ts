import { type CourseProgress, type DemoDatabase, demoDatabase } from './demoDatabase';

export type IncrementCompletedLessonCountInput = {
  userId: string;
  courseId: string;
};

export class CourseProgressRepository {
  constructor(private readonly database: DemoDatabase = demoDatabase) {}

  // 코스 진도 row가 아직 없으면 데모 흐름을 계속 보여줄 수 있도록 기본 row를 만듭니다.
  getUserCourseProgress(userId: string, courseId: string): CourseProgress {
    let progress = this.database.courseProgress.find(
      (courseProgress) => courseProgress.userId === userId && courseProgress.courseId === courseId,
    );

    if (!progress) {
      progress = { userId, courseId, completedLessonCount: 0 };
      this.database.courseProgress.push(progress);
    }

    return progress;
  }

  incrementCompletedLessonCount(input: IncrementCompletedLessonCountInput): CourseProgress {
    // 강의 완료 쓰기와 같은 트랜잭션 안에서 호출되어야 하는 두 번째 쓰기 작업입니다.
    const progress = this.getUserCourseProgress(input.userId, input.courseId);
    progress.completedLessonCount += 1;
    return progress;
  }
}

export const createCourseProgressRepository = (
  database: DemoDatabase = demoDatabase,
): CourseProgressRepository => new CourseProgressRepository(database);
