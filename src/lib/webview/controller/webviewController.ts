import { WebviewPanel } from 'vscode';

import { DetailedSiteInfo, Product } from '../../../atlclients/authInfo';
import { Experiments, Features } from '../../../util/featureFlags';

export type MessagePoster = (m: any) => Thenable<boolean>;

export interface WebviewController<FD> {
    requiredFeatureFlags: Features[];
    requiredExperiments: Experiments[];

    onShown(panel: WebviewPanel): void;
    title(): string;
    screenDetails(): { id: string; site?: DetailedSiteInfo; product?: Product };
    onMessageReceived(msg: any): void;
    update(factoryData?: FD): void;
}
