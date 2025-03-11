module.exports = {
    projects: ['<rootDir>/jest.react.config.js', '<rootDir>/jest.unit.config.js'],
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text-summary', 'clover'],
};
