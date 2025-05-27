import { AuthInfo, ProductJira } from '../../atlclients/authInfo';
import { graphqlRequest } from '../../atlclients/graphql/graphqlClient';
import { notificationFeedVSCode, unseenNotificationCountVSCode } from '../../atlclients/graphql/graphqlDocuments';
import { Container } from '../../container';
import { Logger } from '../../logger';
import { AtlasCodeNotification, NotificationNotifier } from './notificationManager';

export class AtlassianNotificationNotifier implements NotificationNotifier {
    private static instance: AtlassianNotificationNotifier;

    private _lastUnseenNotificationCount: number = 0;
    private _lastPull: number = 0;
    private static readonly NOTIFICATION_INTERVAL_MS = 60 * 1000; // 1 minute

    public static getInstance(): AtlassianNotificationNotifier {
        if (!AtlassianNotificationNotifier.instance) {
            AtlassianNotificationNotifier.instance = new AtlassianNotificationNotifier();
        }
        return AtlassianNotificationNotifier.instance;
    }
    private constructor() {}

    public fetchNotifications(): void {
        Container.credentialManager.getAllValidAuthInfo(ProductJira).then((authInfos: AuthInfo[]) => {
            authInfos.forEach(async (authInfo: AuthInfo) => {
                await this.getLatestNotifications(authInfo);
            });
        });
    }

    private async getLatestNotifications(authInfo: AuthInfo): Promise<void> {
        if (this.shouldRateLimit(authInfo)) {
            return;
        }
        this._lastPull = Date.now();

        const numUnseenNotifications = await this.getNumberOfUnseenNotifications(authInfo);
        if (numUnseenNotifications === this._lastUnseenNotificationCount) {
            Logger.debug(`No changes in unseen notifications for ${authInfo.user.id}`);
            return;
        }
        this._lastUnseenNotificationCount = numUnseenNotifications;

        Logger.debug(`Found ${numUnseenNotifications} unseen notifications for ${authInfo.user.id}`);
        this.getNotificationDetailsByAuthInfo(authInfo, numUnseenNotifications);
    }

    private getNotificationDetailsByAuthInfo(authInfo: AuthInfo, numberToFetch: number): AtlasCodeNotification[] {
        if (numberToFetch <= 0) {
            Logger.debug(`No unseen notifications to fetch for ${authInfo.user.id}`);
            return [];
        }
        Logger.debug(`Fetching notifications for ${authInfo.user.id}`);
        graphqlRequest(notificationFeedVSCode, { first: numberToFetch, productFilter: 'bitbucket' }, authInfo);
        return [];
    }

    private shouldRateLimit(authInfo: AuthInfo): boolean {
        if (Date.now() - this._lastPull < AtlassianNotificationNotifier.NOTIFICATION_INTERVAL_MS) {
            Logger.debug('Not enough time has elapsed since last notification check');
            return true;
        }
        return false;
    }

    private getNumberOfUnseenNotifications(authInfo: AuthInfo): Promise<number> {
        return graphqlRequest(unseenNotificationCountVSCode, {}, authInfo)
            .then((response) => {
                if (response?.notifications?.unseenNotificationCount === undefined) {
                    Logger.warn('unseenNotificationCount is undefined in the response');
                    return 0;
                }
                return response.notifications.unseenNotificationCount;
            })
            .catch((error) => {
                Logger.error(new Error(`Error fetching unseen notification count: ${error}`));
                return 0;
            });
    }
}
