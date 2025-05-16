import { AuthInfo, ProductJira } from '../../atlclients/authInfo';
import { Container } from '../../container';
import { Logger } from '../../logger';
import { AtlasCodeNotification, NotificationNotifier } from './notificationManager';

export class AtlassianNotificationNotifier implements NotificationNotifier {
    private static instance: AtlassianNotificationNotifier;

    private _lastUnseenNotificationCount: number = -1;
    private _lastNotificationSoftPull: number = 0;
    private _lastDetailPull: number = 0;
    private static readonly NOTIFICATION_INTERVAL_MS = 60 * 1000; // 1 minute
    private static readonly FORCE_DETAILS_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

    public static getInstance(): AtlassianNotificationNotifier {
        if (!AtlassianNotificationNotifier.instance) {
            AtlassianNotificationNotifier.instance = new AtlassianNotificationNotifier();
        }
        return AtlassianNotificationNotifier.instance;
    }
    private constructor() {}

    public fetchNotifications(): void {
        if (this.shouldGetNotificationDetails()) {
            this.getNotificationDetails();
        }
    }

    private shouldGetNotificationDetails(): boolean {
        if (this.shouldRateLimit()) {
            return false;
        }

        if (this.isNotificationDetailRefreshNeeded()) {
            return true;
        }

        if (this.hasChangedUnseenNotifications()) {
            return true;
        }

        return false;
    }

    private getNotificationDetails(): void {
        this._lastDetailPull = Date.now();
        Container.credentialManager.getAllValidAuthInfo(ProductJira).then((authInfos: AuthInfo[]) => {
            authInfos.forEach((authInfo: AuthInfo) => {
                // bwieger: make the actual api call here
                this.getNotificationDetailsByAuthInfo(authInfo);
            });
        });
    }

    private getNotificationDetailsByAuthInfo(authInfo: AuthInfo): AtlasCodeNotification[] {
        // bwieger: implement this
        Logger.debug(`Fetching notifications for ${authInfo.user.id}`);
        return [];
    }

    private shouldRateLimit(): boolean {
        if (Date.now() - this._lastNotificationSoftPull >= AtlassianNotificationNotifier.NOTIFICATION_INTERVAL_MS) {
            return true;
        }
        Logger.debug('Not enough time has elapsed since last notification check');
        return false;
    }

    private isNotificationDetailRefreshNeeded(): boolean {
        return this.isFirstDetailPull() || this.isLongTimeSinceLastDetailPull();
    }

    private isFirstDetailPull(): boolean {
        return this._lastDetailPull === 0;
    }

    private isLongTimeSinceLastDetailPull(): boolean {
        return Date.now() - this._lastDetailPull >= AtlassianNotificationNotifier.FORCE_DETAILS_UPDATE_INTERVAL_MS;
    }

    private hasChangedUnseenNotifications(): boolean {
        const currentUnseenCount = this.getUnseenNotifications();

        if (currentUnseenCount !== this._lastUnseenNotificationCount) {
            Logger.debug(
                `Unseen notification count changed from ${this._lastUnseenNotificationCount} to ${currentUnseenCount}`,
            );
            this._lastUnseenNotificationCount = currentUnseenCount;
            return true;
        }

        return false;
    }

    private getUnseenNotifications(): number {
        this._lastNotificationSoftPull = Date.now();
        return 0; // TODO: implement unseen notifications check
    }
}
