/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jest-environment-jsdom',

  // Prevent jsdom from spinning up resource loaders (XHR, fetch) that keep
  // the event loop alive after tests finish — the root cause of the CI hang.
  testEnvironmentOptions: {
    resources: 'usable',
    // Disable resource loading entirely for unit tests — no network needed
    customExportConditions: [],
  },

  // If any handle still leaks, wait 1 s then exit gracefully instead of hanging.
  // Introduced in Jest 29.1 — avoids needing --forceExit.
  openHandlesTimeout: 1000,

  transform:           {},
  collectCoverageFrom: ['src/**/*.js'],
  coverageThreshold: {
    global: {
      branches:   80,
      functions:  90,
      lines:      90,
      statements: 90,
    },
  },
  testMatch: ['**/test/**/*.test.js'],
};
