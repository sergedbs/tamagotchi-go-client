/**
 * Real-target guard. Real tests run only against an explicitly named test target
 * with explicit confirmation; there is no implicit default.
 */
export function requireRealTarget(): string {
  const target = process.env.E2E_REAL_TARGET
  if (!target || process.env.E2E_CONFIRM_TEST_TARGET !== target) {
    throw new Error(
      'Real tests need E2E_REAL_TARGET=<name> and E2E_CONFIRM_TEST_TARGET=<same name>. ' +
        'They write synthetic data to that target through the Gateway proxy.',
    )
  }
  return target
}
