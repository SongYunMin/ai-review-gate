import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { resetDemoData } from '../src/repositories/lessonProgressRepository';

describe('POST /api/lessons/:lessonId/complete', () => {
  beforeEach(() => {
    resetDemoData();
  });

  it('수강 등록된 강의를 완료하고 코스 진도를 한 번만 업데이트한다', async () => {
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

  it('사용자가 강의 코스에 수강 등록되어 있지 않으면 완료 처리를 거절한다', async () => {
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

  it('알 수 없는 강의 id에는 검증 오류를 반환한다', async () => {
    const response = await request(app)
      .post('/api/lessons/unknown-lesson/complete')
      .set('x-user-id', 'user-1')
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('유효하지 않은 강의입니다.');
  });
});
