import FeatureGates, {
    EnvironmentTier,
    Identifiers,
    IFeatureGatesUser,
} from '@atlassian/feature-gate-node-client-standalone';

import {
    ClientInitializedErrorType,
    featureGateExposureBoolEvent,
    featureGateExposureStringEvent,
} from '../../analytics';
import { AnalyticsClient } from '../../analytics-node-client/src/client.min';
import { Logger } from '../../logger';
import { ExperimentGates, ExperimentGateValues, Experiments, FeatureGateValues, Features } from './features';

export type FeatureFlagClientOptions = {
    analyticsClient: AnalyticsClient;
    identifiers: Identifiers;
};

export class FeatureFlagClientInitError {
    constructor(
        public errorType: ClientInitializedErrorType,
        public reason: string,
    ) {}
}

export abstract class FeatureFlagClient {
    private static analyticsClient: AnalyticsClient;
    private static featureGatesInstance: FeatureGates;
    private static featureGateOverrides: FeatureGateValues;
    private static experimentValueOverride: ExperimentGateValues;
    private static identifiers: Identifiers;
    private static initialized = false;
    public static async initialize(options: FeatureFlagClientOptions): Promise<void> {
        this.initializeOverrides();

        this.analyticsClient = options.analyticsClient;
        this.identifiers = options.identifiers;
        const targetApp = process.env.ATLASCODE_STATSIG_TARGET_APP;
        const environment = process.env.ATLASCODE_FX3_ENVIRONMENT as EnvironmentTier;
        const sdkKey = process.env.ATLASCODE_STATSIG_SDK_KEY;
        const timeout = process.env.ATLASCODE_FX3_TIMEOUT;
        if (!targetApp || !environment || !sdkKey || !timeout) {
            return Promise.reject(
                new FeatureFlagClientInitError(ClientInitializedErrorType.Skipped, 'env data not set'),
            );
        }

        if (!options.identifiers.analyticsAnonymousId) {
            return Promise.reject(
                new FeatureFlagClientInitError(ClientInitializedErrorType.IdMissing, 'analyticsAnonymousId not set'),
            );
        }

        Logger.debug(`FeatureGates: initializing, target: ${targetApp}, environment: ${environment}`);

        try {
            this.featureGatesInstance = await FeatureGates.initialize({
                environmentTier: environment,
                targetApp,
                serverSecretKey: sdkKey,
            });
            this.initialized = true;
        } catch (err) {
            return Promise.reject(new FeatureFlagClientInitError(ClientInitializedErrorType.Failed, err));
        }
    }

    private static initializeOverrides(): void {
        this.featureGateOverrides = {} as FeatureGateValues;
        this.experimentValueOverride = {} as ExperimentGateValues;

        const ffSplit = (process.env.ATLASCODE_FF_OVERRIDES || '')
            .split(',')
            .map(this.parseBoolOverride<Features>)
            .filter((x) => !!x);

        for (const { key, value } of ffSplit) {
            this.featureGateOverrides[key] = value;
        }

        const boolExpSplit = (process.env.ATLASCODE_EXP_OVERRIDES_BOOL || '')
            .split(',')
            .map(this.parseBoolOverride<Experiments>)
            .filter((x) => !!x);

        for (const { key, value } of boolExpSplit) {
            this.experimentValueOverride[key] = value;
        }

        const strExpSplit = (process.env.ATLASCODE_EXP_OVERRIDES_STRING || '')
            .split(',')
            .map(this.parseStringOverride)
            .filter((x) => !!x);

        for (const { key, value } of strExpSplit) {
            this.experimentValueOverride[key] = value;
        }
    }

    private static parseBoolOverride<T>(setting: string): { key: T; value: boolean } | undefined {
        const [key, valueRaw] = setting
            .trim()
            .split('=', 2)
            .map((x) => x.trim());

        if (key) {
            const value = valueRaw.toLowerCase() === 'true';
            return { key: key as T, value };
        } else {
            return undefined;
        }
    }

    private static parseStringOverride(setting: string): { key: Experiments; value: string } | undefined {
        const [key, value] = setting
            .trim()
            .split('=', 2)
            .map((x) => x.trim());
        if (key) {
            return { key: key as Experiments, value };
        } else {
            return undefined;
        }
    }

    static checkGate(gate: Features): boolean {
        if (this.featureGateOverrides.hasOwnProperty(gate)) {
            return this.featureGateOverrides[gate];
        }
        const user: IFeatureGatesUser = {
            identifiers: { analyticsAnonymousId: this.identifiers.analyticsAnonymousId || '' },
        };
        let gateValue = false;
        if (this.initializeCompleted()) {
            gateValue = this.featureGatesInstance.checkGate(user, gate);
        }
        Logger.debug(`FeatureGates ${gate} -> ${gateValue}`);
        return gateValue;
    }

    static checkExperimentValue(experiment: Experiments): any {
        // unknown experiment name
        if (!ExperimentGates.hasOwnProperty(experiment)) {
            return undefined;
        }

        if (this.experimentValueOverride.hasOwnProperty(experiment)) {
            return this.experimentValueOverride[experiment];
        }
        const user: IFeatureGatesUser = {
            identifiers: { analyticsAnonymousId: this.identifiers.analyticsAnonymousId || '' },
        };
        const experimentGate = ExperimentGates[experiment];
        let gateValue = experimentGate.defaultValue;
        if (this.initializeCompleted()) {
            gateValue = this.featureGatesInstance.getExperimentValue(user, {
                name: experiment,
                parameter: experimentGate.parameter,
                defaultValue: experimentGate.defaultValue,
            });
        }
        Logger.debug(`Experiment ${experiment} -> ${gateValue}`);
        return gateValue;
    }

    static checkGateValueWithInstrumentation(gate: Features): boolean {
        if (this.featureGateOverrides.hasOwnProperty(gate)) {
            const value = this.featureGateOverrides[gate];
            featureGateExposureBoolEvent(gate, false, value, 3).then((e) => {
                this.analyticsClient.sendTrackEvent(e);
            });
            return value;
        }
        const user: IFeatureGatesUser = {
            identifiers: { analyticsAnonymousId: this.identifiers.analyticsAnonymousId || '' },
        };
        let gateValue = false;
        if (this.initializeCompleted()) {
            // FeatureGates.checkGate returns false if any errors
            gateValue = this.featureGatesInstance.checkGate(user, gate);
            featureGateExposureBoolEvent(gate, true, gateValue, 0).then((e) => {
                this.analyticsClient.sendTrackEvent(e);
            });
        } else {
            featureGateExposureBoolEvent(gate, false, gateValue, 1).then((e) => {
                this.analyticsClient.sendTrackEvent(e);
            });
        }

        Logger.debug(`FeatureGates ${gate} -> ${gateValue}`);
        return gateValue;
    }

    static checkExperimentStringValueWithInstrumentation(experiment: Experiments): string | undefined {
        // unknown experiment name
        if (!ExperimentGates.hasOwnProperty(experiment)) {
            featureGateExposureStringEvent(experiment, false, '', 2).then((e) => {
                this.analyticsClient.sendTrackEvent(e);
            });
            return undefined;
        }

        if (this.experimentValueOverride.hasOwnProperty(experiment)) {
            const value = this.experimentValueOverride[experiment] as string;
            featureGateExposureStringEvent(experiment, false, value, 3).then((e) => {
                this.analyticsClient.sendTrackEvent(e);
            });
            return value;
        }
        const user: IFeatureGatesUser = {
            identifiers: { analyticsAnonymousId: this.identifiers.analyticsAnonymousId || '' },
        };
        const experimentGate = ExperimentGates[experiment];
        let gateValue = experimentGate.defaultValue as string;
        if (this.initializeCompleted()) {
            gateValue = this.featureGatesInstance.getExperimentValue(user, {
                name: experiment,
                parameter: experimentGate.parameter,
                defaultValue: experimentGate.defaultValue,
            });

            if (gateValue === experimentGate.defaultValue) {
                featureGateExposureStringEvent(experiment, false, gateValue, 4).then((e) => {
                    this.analyticsClient.sendTrackEvent(e);
                });
            } else {
                featureGateExposureStringEvent(experiment, true, gateValue, 0).then((e) => {
                    this.analyticsClient.sendTrackEvent(e);
                });
            }
        } else {
            featureGateExposureStringEvent(experiment, false, gateValue, 1).then((e) => {
                this.analyticsClient.sendTrackEvent(e);
            });
        }

        Logger.debug(`Experiment ${experiment} -> ${gateValue}`);
        return gateValue;
    }

    static dispose() {
        this.featureGatesInstance.shutdown();
    }

    static initializeCompleted() {
        return this.initialized;
    }
}
