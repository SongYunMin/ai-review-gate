import {
  type DemoDatabase,
  type Lesson,
  type LessonProgress,
  demoDatabase,
  resetDatabase,
  runInTransaction,
} from './demoDatabase';

export type CreateLessonCompletionInput = {
  userId: string;
  lessonId: string;
  completedAt: Date;
};

export class LessonProgressRepository {
  constructor(private readonly database: DemoDatabase = demoDatabase) {}

  // repository는 저장소 조회만 담당하고, HTTP 요청이나 응답 형태는 알지 못하게 유지합니다.
  findLessonById(lessonId: string): Lesson | undefined {
    return this.database.lessons.find((lesson) => lesson.id === lessonId);
  }

  isUserEnrolledInCourse(userId: string, courseId: string): boolean {
    return this.database.enrollments.some(
      (enrollment) => enrollment.userId === userId && enrollment.courseId === courseId,
    );
  }

  findCompletion(userId: string, lessonId: string): LessonProgress | undefined {
    return this.database.lessonProgress.find(
      (progress) => progress.userId === userId && progress.lessonId === lessonId,
    );
  }

  createCompletion(input: CreateLessonCompletionInput): LessonProgress {
    // 실제 서비스라면 INSERT에 해당하는 지점이며, 데모에서는 배열에 row를 추가합니다.
    const progress: LessonProgress = {
      userId: input.userId,
      lessonId: input.lessonId,
      status: 'completed',
      completedAt: input.completedAt.toISOString(),
    };

    this.database.lessonProgress.push(progress);
    return progress;
  }
}

export const createLessonProgressRepository = (
  database: DemoDatabase = demoDatabase,
): LessonProgressRepository => new LessonProgressRepository(database);

export const resetDemoData = resetDatabase;

export const runLessonProgressTransaction = runInTransaction;
