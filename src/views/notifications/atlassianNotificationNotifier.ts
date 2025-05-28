import { Uri } from 'vscode';

import { AuthInfo, ProductBitbucket, ProductJira } from '../../atlclients/authInfo';
import { graphqlRequest } from '../../atlclients/graphql/graphqlClient';
import { notificationFeedVSCode, unseenNotificationCountVSCode } from '../../atlclients/graphql/graphqlDocuments';
import { Container } from '../../container';
import { Logger } from '../../logger';
import {
    AtlasCodeNotification,
    NotificationManagerImpl,
    NotificationNotifier,
    NotificationType,
} from './notificationManager';

export class AtlassianNotificationNotifier implements NotificationNotifier {
    private static instance: AtlassianNotificationNotifier;

    private _lastUnseenNotificationCount: Record<string, number> = {};
    private _lastPull: Record<string, number> = {};
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
        this._lastPull[authInfo.user.id] = Date.now();

        const numUnseenNotifications = await this.getNumberOfUnseenNotifications(authInfo);
        if (numUnseenNotifications === this._lastUnseenNotificationCount[authInfo.user.id]) {
            Logger.debug(`No changes in unseen notifications for ${authInfo.user.id}`);
            return;
        }
        this._lastUnseenNotificationCount[authInfo.user.id] = numUnseenNotifications;

        Logger.debug(`Found ${numUnseenNotifications} unseen notifications for ${authInfo.user.id}`);
        this.getNotificationDetailsByAuthInfo(authInfo, numUnseenNotifications);
    }

    private getNotificationDetailsByAuthInfo(authInfo: AuthInfo, numberToFetch: number): void {
        if (numberToFetch <= 0) {
            Logger.debug(`No unseen notifications to fetch for ${authInfo.user.id}`);
            return;
        }
        Logger.debug(`Fetching notifications for ${authInfo.user.id}`);
        graphqlRequest(notificationFeedVSCode, { first: numberToFetch }, authInfo)
            .then((response) => {
                if (!response?.notifications?.notificationFeed?.nodes) {
                    Logger.warn('notificationFeed is undefined in the response');
                    return;
                }
                response.notifications.notificationFeed.nodes
                    .filter((node: any) => this.filter(node))
                    .map((node: any) => {
                        const notification = this.mapper(authInfo, node);
                        if (notification) {
                            NotificationManagerImpl.getInstance().addNotification(notification);
                        }
                    });
            })
            .catch((error) => {
                Logger.error(error, 'Error fetching notifications');
            });
    }

    private mapper(authInfo: AuthInfo, node: any): AtlasCodeNotification | undefined {
        const product = this.isJiraNotification(node)
            ? ProductJira
            : this.isBitbucketNotification(node)
              ? ProductBitbucket
              : undefined;
        if (!product) {
            Logger.warn(`Unsupported notification type for URL: ${node.headNotification.content.url}`);
            return undefined;
        }
        const notificationType = product === ProductJira ? NotificationType.JiraComment : NotificationType.PRComment;

        // Strip query parameters from the URL before creating the Uri
        const url = node.headNotification.content.url.split('?')[0];

        return {
            id: node.headNotification.notificationId,
            uri: Uri.parse(url),
            message: node.headNotification.content.message,
            notificationType: notificationType,
            product: product,
            credentialId: authInfo.user.id, // bwieger, check this
        };
    }

    private isJiraNotification(node: any): boolean {
        return node.headNotification.content.url.includes('atlassian.net/browse/');
    }

    private isBitbucketNotification(node: any): boolean {
        return node.headNotification.content.url.includes('bitbucket.org/');
    }

    private isCommentNotification(node: any): boolean {
        return node.headNotification.content.message.toLowerCase().includes('comment');
    }

    private filter(node: any): boolean {
        const isComment = this.isCommentNotification(node);
        const isJira = this.isJiraNotification(node);
        const isBitbucket = this.isBitbucketNotification(node);

        if (isJira) {
            if (isComment) {
                return true; // Include Jira comments
            }
        }
        if (isBitbucket) {
            if (isComment) {
                return true; // Include Jira comments
            }
        }

        return false;
    }

    private shouldRateLimit(authInfo: AuthInfo): boolean {
        // Use per-user last pull
        const lastPull = this._lastPull[authInfo.user.id] || 0;
        if (Date.now() - lastPull < AtlassianNotificationNotifier.NOTIFICATION_INTERVAL_MS) {
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
