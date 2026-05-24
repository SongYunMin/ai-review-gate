import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { resetDemoData } from '../src/repositories/lessonProgressRepository';

describe('POST /api/lessons/:lessonId/complete', () => {
  beforeEach(() => {
    resetDemoData();
  });

  it('completes an enrolled lesson and updates course progress once', async () => {
    const firstResponse = await request(app)
      .post('/api/lessons/lesson-1/complete')
      .set('x-user-id', 'user-1')
      .send();

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toMatchObject({
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

    const duplicateResponse = await request(app)
      .post('/api/lessons/lesson-1/complete')
      .set('x-user-id', 'user-1')
      .send();

    expect(duplicateResponse.status).toBe(200);
    expect(duplicateResponse.body.courseProgress.completedLessonCount).toBe(1);
  });

  it('rejects completion when the user is not enrolled in the lesson course', async () => {
    const response = await request(app)
      .post('/api/lessons/lesson-3/complete')
      .set('x-user-id', 'user-1')
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: '강의 수강 권한이 없습니다.',
      },
    });
  });

  it('returns validation error for an unknown lesson id', async () => {
    const response = await request(app)
      .post('/api/lessons/unknown-lesson/complete')
      .set('x-user-id', 'user-1')
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('유효하지 않은 강의입니다.');
  });
});
