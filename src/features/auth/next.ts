/** Only same-app paths are accepted as post-login destinations. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/creatures'
  if (value.startsWith('/login') || value.startsWith('/register')) return '/creatures'
  return value
}
