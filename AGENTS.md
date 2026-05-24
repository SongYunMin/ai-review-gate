# AGENTS.md

## Project Overview

This repository is a small Node.js TypeScript REST API demo for an edtech lesson completion flow.
The review gate must treat this file as the team's convention source of truth.

## Backend Architecture Rules

- Controllers should be thin.
- Business logic must live in service classes.
- Repositories should not be called directly from controllers.
- Controllers may parse request data and return responses, but they must delegate workflow decisions to services.
- Repositories should hide storage details and should not contain request/response logic.

## Data Access Rules

- User-specific data access must verify ownership or enrollment.
- Lesson completion must verify that the requesting user is enrolled in the lesson's course.
- Write operations that update multiple tables must use transactions.
- APIs that can be retried must be idempotent when possible.

## API Error Handling Rules

- Do not expose internal error messages to clients.
- Public API errors should use stable, user-safe messages.
- Internal error details may be logged server-side, but must not be returned in JSON responses.

## Test Rules

- Add tests for authorization failure, duplicate requests, transaction failure, and validation failure when relevant.
- Happy-path tests are not enough for write APIs that affect user progress.
- When changing a retryable endpoint, include an idempotency test.

## AI Review Gate Rules

- Review PR diffs against this file first.
- Prefer concrete findings with file paths and line hints.
- Do not invent findings that are not visible in the diff or directly implied by the diff.
- Findings that affect authorization, transaction integrity, or unsafe error exposure should be treated as merge-blocking candidates.
