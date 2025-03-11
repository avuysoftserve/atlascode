module.exports = {
    displayName: 'react',
    roots: ['<rootDir>'],
    testMatch: ['**/react/**/*.test.tsx'],
    transform: {
        '^.+\\.(min.js|js|ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.react.json',
                isolatedModules: true,
            },
        ],
    },
    transformIgnorePatterns: ['/node_modules/(?!(@vscode/webview-ui-toolkit/|@microsoft/|exenv-es6/))'],
    testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/setupTestsReact.js'],
    // coverage configuration
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text-summary', 'clover'],
    testEnvironment: 'jsdom',
};
