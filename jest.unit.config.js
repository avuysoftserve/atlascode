module.exports = {
    preset: 'ts-jest',
    displayName: 'unit',
    roots: ['<rootDir>'],
    testMatch: ['**/test/**/*.+(ts|ts|js)', '**/?(*.)+(spec|test).+(ts|ts|js)'],
    transform: {
        '^.+\\.(min.js|ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
            },
        ],
    },
    transformIgnorePatterns: ['/node_modules/'],
    testPathIgnorePatterns: ['/node_modules/', '/e2e/', 'src/react'],
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
    // coverage configuration
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text-summary', 'clover'],
};
