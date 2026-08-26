// Node enforces these directly; vitest.config.ts binds them for workerd.
// Imported by both, so the two runtimes cannot drift onto different budgets.
export const TEST_LIMIT = 3;
export const TEST_PERIOD = 60;
export const OTHER_LIMIT = 1;
export const OTHER_PERIOD = 10;
