import { expect } from 'vitest'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export function expectSuccess<T>(result: ActionResult<T>): asserts result is { success: true; data?: T } {
  expect(result.success).toBe(true)
}

export function expectError<T>(
  result: ActionResult<T>,
  errorContains?: string
): asserts result is { success: false; error: string } {
  expect(result.success).toBe(false)
  if (errorContains && !result.success) {
    expect(result.error).toContain(errorContains)
  }
}
