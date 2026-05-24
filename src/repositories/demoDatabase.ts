export type Lesson = {
  id: string;
  courseId: string;
  title: string;
};

export type Enrollment = {
  userId: string;
  courseId: string;
};

export type LessonProgress = {
  userId: string;
  lessonId: string;
  status: 'completed';
  completedAt: string;
};

export type CourseProgress = {
  userId: string;
  courseId: string;
  completedLessonCount: number;
};

export type DemoDatabase = {
  lessons: Lesson[];
  enrollments: Enrollment[];
  lessonProgress: LessonProgress[];
  courseProgress: CourseProgress[];
};

// 외부 DB 없이도 Review Gate 발표를 재현할 수 있도록 고정된 인메모리 seed를 사용합니다.
const createSeedDatabase = (): DemoDatabase => ({
  lessons: [
    { id: 'lesson-1', courseId: 'course-1', title: '분수의 기초' },
    { id: 'lesson-2', courseId: 'course-1', title: '약분과 통분' },
    { id: 'lesson-3', courseId: 'course-2', title: '함수 입문' },
  ],
  enrollments: [
    { userId: 'user-1', courseId: 'course-1' },
    { userId: 'user-2', courseId: 'course-2' },
  ],
  lessonProgress: [],
  courseProgress: [
    { userId: 'user-1', courseId: 'course-1', completedLessonCount: 0 },
    { userId: 'user-2', courseId: 'course-2', completedLessonCount: 0 },
  ],
});

export const demoDatabase: DemoDatabase = createSeedDatabase();

// 트랜잭션 데모에서 작업 중 데이터와 커밋된 데이터를 분리하기 위한 얕은 레코드 복사입니다.
const cloneDatabase = (database: DemoDatabase): DemoDatabase => ({
  lessons: database.lessons.map((lesson) => ({ ...lesson })),
  enrollments: database.enrollments.map((enrollment) => ({ ...enrollment })),
  lessonProgress: database.lessonProgress.map((progress) => ({ ...progress })),
  courseProgress: database.courseProgress.map((progress) => ({ ...progress })),
});

const replaceDatabase = (target: DemoDatabase, source: DemoDatabase): void => {
  target.lessons = source.lessons;
  target.enrollments = source.enrollments;
  target.lessonProgress = source.lessonProgress;
  target.courseProgress = source.courseProgress;
};

export const resetDatabase = (): void => {
  // 테스트마다 같은 시작 상태를 보장해 중복 완료와 권한 실패를 안정적으로 검증합니다.
  replaceDatabase(demoDatabase, createSeedDatabase());
};

export const runInTransaction = async <T>(
  work: (transactionDatabase: DemoDatabase) => Promise<T>,
): Promise<T> => {
  // 데모용 인메모리 트랜잭션입니다. 실제 DB라면 BEGIN/COMMIT/ROLLBACK 경계가 됩니다.
  const transactionDatabase = cloneDatabase(demoDatabase);
  const result = await work(transactionDatabase);
  replaceDatabase(demoDatabase, transactionDatabase);
  return result;
};
