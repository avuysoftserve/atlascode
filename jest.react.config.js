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
    setupFilesAfterEnv: ['<rootDir>/setupTestsReact.js'],
    // coverage configuration

    testEnvironment: 'jsdom',
};
