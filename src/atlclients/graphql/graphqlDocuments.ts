import { gql } from 'graphql-request';

export const unseenNotificationCountVSCode = gql`
    query unseenNotificationCountVSCode {
        notifications {
            unseenNotificationCount
        }
    }
`;
