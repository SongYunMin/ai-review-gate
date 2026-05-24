import { type CourseProgress, type DemoDatabase, demoDatabase } from './demoDatabase';

export type IncrementCompletedLessonCountInput = {
  userId: string;
  courseId: string;
};

export class CourseProgressRepository {
  constructor(private readonly database: DemoDatabase = demoDatabase) {}

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
    const progress = this.getUserCourseProgress(input.userId, input.courseId);
    progress.completedLessonCount += 1;
    return progress;
  }
}

export const createCourseProgressRepository = (
  database: DemoDatabase = demoDatabase,
): CourseProgressRepository => new CourseProgressRepository(database);
