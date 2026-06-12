export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export function actionSuccess<T = void>(data?: T): ActionResult<T> {
  return { success: true, data }
}

export function actionError<T = void>(error: string): ActionResult<T> {
  return { success: false, error }
}
