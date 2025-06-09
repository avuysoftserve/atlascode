import {
    createEmptyMinimalIssue,
    createIssueNotFoundIssue,
    isIssueKeyAndSite,
    isMinimalIssue,
    MinimalIssue,
    MinimalIssueOrKeyAndSite,
} from '@atlassianlabs/jira-pi-common-models';
import * as vscode from 'vscode';

import { DetailedSiteInfo, emptySiteInfo, ProductJira } from '../../atlclients/authInfo';
import { Container } from '../../container';
import { getCachedOrFetchMinimalIssue } from '../../jira/fetchIssue';
import { issueForKey } from '../../jira/issueForKey';
import { Logger } from '../../logger';

export async function showIssue(issueOrKeyAndSite: MinimalIssueOrKeyAndSite<DetailedSiteInfo>) {
    let issue: MinimalIssue<DetailedSiteInfo>;

    if (isMinimalIssue(issueOrKeyAndSite)) {
        issue = issueOrKeyAndSite;
    } else {
        let issueKey: string = '';
        let site: DetailedSiteInfo = emptySiteInfo;

        if (isIssueKeyAndSite(issueOrKeyAndSite)) {
            issueKey = issueOrKeyAndSite.key;
            site = issueOrKeyAndSite.siteDetails;
        } else {
            Container.jiraIssueViewManager.createOrShow(createIssueNotFoundIssue(createEmptyMinimalIssue(site)));
            return;
        }

        // Note: we try to get the cached issue first because it will contain epic child info we need
        issue = await getCachedOrFetchMinimalIssue(issueKey, site);

        if (!issue) {
            throw new Error(`Jira issue ${issueKey} not found in site ${site.host}`);
        }
    }

    Container.jiraIssueViewManager.createOrShow(issue);
}

export async function showIssueForURL(issueURL: string) {
    try {
        const url = new URL(issueURL);
        const hostname = url.hostname;
        // Match something like /AXON-123 in the path
        const match = url.pathname.match(/\/([A-Z][A-Z0-9]+-\d+)/i);
        const issueKey = match ? match[1] : undefined;

        if (!issueKey) {
            throw new Error('Issue key not found in URL');
        }

        // Try to find the site by hostname
        const site = Container.siteManager.getSiteForHostname(ProductJira, hostname);

        if (!site) {
            throw new Error(`No site found for hostname: ${hostname}`);
        }

        await showIssueForSiteIdAndKey(site.id, issueKey);
    } catch (e) {
        vscode.window.showErrorMessage('Invalid URL.');
        Logger.error(e, 'Could not show issue for URL');
    }
}
export async function showIssueForSiteIdAndKey(siteId: string, issueKey: string) {
    const site: DetailedSiteInfo | undefined = Container.siteManager.getSiteForId(ProductJira, siteId);

    const issue = site
        ? await getCachedOrFetchMinimalIssue(issueKey, site)
        : createIssueNotFoundIssue(createEmptyMinimalIssue(emptySiteInfo));

    Container.jiraIssueViewManager.createOrShow(issue);
}

export async function showIssueForKey(issueKey?: string) {
    let issue: MinimalIssue<DetailedSiteInfo> = createIssueNotFoundIssue(createEmptyMinimalIssue(emptySiteInfo));

    if (issueKey === undefined) {
        const input = await vscode.window.showInputBox({ prompt: 'Enter issue key' });
        if (input) {
            issueKey = input.trim();
        }
    } else {
        issueKey = issueKey;
    }

    if (issueKey) {
        try {
            issue = await issueForKey(issueKey);
        } catch {
            //not found
        }
    }

    Container.jiraIssueViewManager.createOrShow(issue);
}
