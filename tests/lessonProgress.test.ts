import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { resetDemoData } from '../src/repositories/lessonProgressRepository';

describe('POST /api/lessons/:lessonId/complete', () => {
  beforeEach(() => {
    resetDemoData();
  });

  it('수강 등록된 강의를 완료한다', async () => {
    const response = await request(app)
      .post('/api/lessons/lesson-1/complete')
      .set('x-user-id', 'user-1')
      .send();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      progress: {
        userId: 'user-1',
        lessonId: 'lesson-1',
        status: 'completed',
      },
      courseProgress: {
        userId: 'user-1',
        courseId: 'course-1',
        completedLessonCount: 1,
      },
    });
  });
});
