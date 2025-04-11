const MockedFeatureGates_Features: Record<any, boolean> = {
    'some-very-real-feature': true,
    'another-very-real-feature': true,
};

const MockExperimentGates: Record<string, any> = {
    'some-very-real-experiment': {
        parameter: 'isEnabled',
        defaultValue: 'a default value',
    },
    'another-exp-name': {
        parameter: 'isEnabled',
        defaultValue: 'another default value',
    },
};

jest.mock('./features', () => {
    return {
        ExperimentGates: MockExperimentGates,
    };
});

jest.mock('@atlassian/feature-gate-node-client-standalone', () => {
    return {
        ...jest.requireActual('@atlassian/feature-gate-node-client-standalone'),
        default: {
            initialize: () => Promise.resolve(),
        },
    };
});

import FeatureGates, { IFeatureGatesUser } from '@atlassian/feature-gate-node-client-standalone';

import { forceCastTo } from '../../../testsutil';
import { ClientInitializedErrorType } from '../../analytics';
import { FeatureFlagClient, FeatureFlagClientInitError, FeatureFlagClientOptions } from './client';
import { Experiments, Features } from './features';

describe('FeatureFlagClient', () => {
    let analyticsClient: any;
    let options: FeatureFlagClientOptions;
    const originalEnv = process.env;
    let mockFeatureGates: FeatureGates;
    beforeEach(() => {
        analyticsClient = {
            sendOperationalEvent: jest.fn(),
            sendTrackEvent: jest.fn(),
        };
        options = {
            analyticsClient,
            identifiers: {
                analyticsAnonymousId: 'some-id',
            },
        };
        process.env = {
            ...originalEnv,
            ATLASCODE_FX3_ENVIRONMENT: 'Production',
            ATLASCODE_FX3_TIMEOUT: '2000',
            ATLASCODE_STATSIG_TARGET_APP: 'some-app',
            ATLASCODE_STATSIG_SDK_KEY: 'some-key',
            ATLASCODE_FF_OVERRIDES: undefined,
            ATLASCODE_EXP_OVERRIDES_BOOL: undefined,
            ATLASCODE_EXP_OVERRIDES_STRING: undefined,
        };
        mockFeatureGates = {
            checkGate: jest.fn(),
            getExperimentValue: jest.fn(),
            initialize: jest.fn(),
        } as unknown as FeatureGates;
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    describe('initialize', () => {
        it('should initialize the feature flag client', async () => {
            jest.spyOn(FeatureGates, 'initialize');

            await FeatureFlagClient.initialize(options);
            expect(FeatureGates.initialize).toHaveBeenCalled();
        });

        it('should catch an error when the feature flag client fails to initialize', async () => {
            jest.spyOn(FeatureGates, 'initialize').mockRejectedValue('error');

            let error: FeatureFlagClientInitError = undefined!;

            try {
                await FeatureFlagClient.initialize(options);
            } catch (err) {
                error = err;
            }

            expect(FeatureGates.initialize).toHaveBeenCalled();
            expect(error).toBeDefined();
            expect(error.errorType).toBe(ClientInitializedErrorType.Failed);
        });

        it('should catch an error when the feature flag client skipped initialization', async () => {
            jest.spyOn(FeatureGates, 'initialize');
            process.env.ATLASCODE_STATSIG_SDK_KEY = '';

            let error: FeatureFlagClientInitError = undefined!;

            try {
                await FeatureFlagClient.initialize(options);
            } catch (err) {
                error = err;
            }

            expect(FeatureGates.initialize).not.toHaveBeenCalled();
            expect(error).toBeDefined();
            expect(error.errorType).toBe(ClientInitializedErrorType.Skipped);
        });

        it("should catch an error when the analyticsAnonymousId isn't set", async () => {
            jest.spyOn(FeatureGates, 'initialize');
            options.identifiers.analyticsAnonymousId = '';

            let error: FeatureFlagClientInitError = undefined!;

            try {
                await FeatureFlagClient.initialize(options);
            } catch (err) {
                error = err;
            }

            expect(FeatureGates.initialize).not.toHaveBeenCalled();
            expect(error).toBeDefined();
            expect(error.errorType).toBe(ClientInitializedErrorType.IdMissing);
        });

        it('checkGate returns what FeatureGates returns', async () => {
            const mockedCheckGate = (user: IFeatureGatesUser, name: string) =>
                MockedFeatureGates_Features[name] ?? false;

            jest.spyOn(FeatureGates, 'initialize').mockReturnValue(Promise.resolve(mockFeatureGates));
            jest.spyOn(FeatureFlagClient, 'initializeCompleted').mockReturnValue(true);
            jest.spyOn(mockFeatureGates, 'checkGate').mockImplementation(mockedCheckGate);
            await FeatureFlagClient.initialize(options);
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('some-very-real-feature'))).toBeTruthy();
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('another-very-real-feature'))).toBeTruthy();
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('some-fake-feature'))).toBeFalsy();
        });

        it('if overrides are set, checkGate returns the overridden value', async () => {
            process.env.ATLASCODE_FF_OVERRIDES = `another-very-real-feature=false`;

            const mockedCheckGate = (user: IFeatureGatesUser, name: string) =>
                MockedFeatureGates_Features[name] ?? false;
            jest.spyOn(FeatureGates, 'initialize').mockReturnValue(Promise.resolve(mockFeatureGates));
            jest.spyOn(FeatureFlagClient, 'initializeCompleted').mockReturnValue(true);
            jest.spyOn(mockFeatureGates, 'checkGate').mockImplementation(mockedCheckGate);
            await FeatureFlagClient.initialize(options);
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('some-very-real-feature'))).toBeTruthy();
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('another-very-real-feature'))).toBeFalsy();
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('some-fake-feature'))).toBeFalsy();
        });

        it('if FeatureGates is not initialized, checkGate always returns false', async () => {
            jest.spyOn(FeatureGates, 'initialize').mockReturnValue(Promise.resolve(mockFeatureGates));
            jest.spyOn(FeatureFlagClient, 'initializeCompleted').mockReturnValue(false);
            jest.spyOn(mockFeatureGates, 'checkGate');
            await FeatureFlagClient.initialize(options);
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('some-very-real-feature'))).toBeFalsy();
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('another-very-real-feature'))).toBeFalsy();
            expect(FeatureFlagClient.checkGate(forceCastTo<Features>('some-fake-feature'))).toBeFalsy();

            expect(mockFeatureGates.checkGate).not.toHaveBeenCalled();
        });

        it('checkExperimentValue returns what FeatureGates returns', async () => {
            const mockedGetExperimentValue = (
                user: IFeatureGatesUser,
                params: { name: string; parameter: string; defaultValue: any },
            ) => {
                const expData = MockExperimentGates[params.name];
                if (!expData || expData.parameter !== params.parameter) {
                    return '';
                }
                return 'returned value';
            };
            jest.spyOn(FeatureGates, 'initialize').mockReturnValue(Promise.resolve(mockFeatureGates));
            jest.spyOn(FeatureFlagClient, 'initializeCompleted').mockReturnValue(true);
            jest.spyOn(mockFeatureGates, 'getExperimentValue').mockImplementation(mockedGetExperimentValue);
            await FeatureFlagClient.initialize(options);
            expect(FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('some-very-real-experiment'))).toBe(
                'returned value',
            );
            expect(FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('another-exp-name'))).toBe(
                'returned value',
            );
            expect(
                FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('one-more-exp-name')),
            ).toBeUndefined();
        });

        it('if overrides are set, getExperimentValue returns the overridden value', async () => {
            process.env.ATLASCODE_EXP_OVERRIDES_STRING = `another-exp-name=another value`;

            const mockedGetExperimentValue = (
                user: IFeatureGatesUser,
                params: { name: string; parameter: string; defaultValue: any },
            ) => {
                const expData = MockExperimentGates[params.name];
                if (!expData || expData.parameter !== params.parameter) {
                    return '';
                }
                return 'returned value';
            };
            jest.spyOn(FeatureGates, 'initialize').mockReturnValue(Promise.resolve(mockFeatureGates));
            jest.spyOn(FeatureFlagClient, 'initializeCompleted').mockReturnValue(true);
            jest.spyOn(mockFeatureGates, 'getExperimentValue').mockImplementation(mockedGetExperimentValue);

            await FeatureFlagClient.initialize(options);
            expect(FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('some-very-real-experiment'))).toBe(
                'returned value',
            );
            expect(FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('another-exp-name'))).toBe(
                'another value',
            );
            expect(
                FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('one-more-exp-name')),
            ).toBeUndefined();
        });

        it('if FeatureGates is not initialized, getExperimentValue returns the default value', async () => {
            jest.spyOn(FeatureGates, 'initialize').mockReturnValue(Promise.resolve(mockFeatureGates));
            jest.spyOn(FeatureFlagClient, 'initializeCompleted').mockReturnValue(false);
            jest.spyOn(mockFeatureGates, 'getExperimentValue');
            await FeatureFlagClient.initialize(options);
            expect(FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('some-very-real-experiment'))).toBe(
                'a default value',
            );
            expect(FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('another-exp-name'))).toBe(
                'another default value',
            );
            expect(
                FeatureFlagClient.checkExperimentValue(forceCastTo<Experiments>('one-more-exp-name')),
            ).toBeUndefined();

            expect(mockFeatureGates.getExperimentValue).not.toHaveBeenCalled();
        });
    });
});
