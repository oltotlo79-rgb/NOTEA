export const UNTITLED = '無題'

export function displayTitle(title: string | null | undefined): string {
  return title?.trim() ? title : UNTITLED
}
