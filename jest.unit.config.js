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
    setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
};
