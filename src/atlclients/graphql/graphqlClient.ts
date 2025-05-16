import { request } from 'graphql-request';

import { AuthInfo, isOAuthInfo } from '../authInfo';

export async function graphqlRequest<T = any>(
    document: string,
    variables: Record<string, any>,
    authInfo: AuthInfo,
    endpoint: string = 'https://api.atlassian.com/graphql',
): Promise<T> {
    if (!document) {
        throw new Error('GraphQL document is not set.');
    }
    if (!authInfo) {
        throw new Error('Auth info is not set.');
    }

    return request<T>(endpoint, document, variables, createHeaders(authInfo));
}

function createHeaders(authInfo: AuthInfo) {
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    setAuthorizationHeader(authInfo, headers);
    return headers;
}

function setAuthorizationHeader(authInfo: AuthInfo, headers: Record<string, string>) {
    if (isOAuthInfo(authInfo)) {
        headers['Authorization'] = `Bearer ${authInfo.access}`;
    } else {
        throw new Error('Unsupported authentication type.');
    }
}
