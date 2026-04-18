/** @type {import('jest').Config} */
export default {
  testEnvironment:     'jest-environment-jsdom',
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
