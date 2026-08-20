import type { ReviewResult } from '../schemas/review-result.schema';

export type ReviewExitCode = 0 | 2 | 10;

export const resolveReviewExitCode = (result: ReviewResult, enforce: boolean): ReviewExitCode => {
  if (result.shouldBlockMerge) {
    return enforce ? 10 : 0;
  }

  if ((result.validationWarnings?.length ?? 0) > 0) {
    return 2;
  }

  return 0;
};
