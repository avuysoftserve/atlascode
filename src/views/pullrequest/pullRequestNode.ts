import { parseISO } from 'date-fns';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import * as vscode from 'vscode';
import { clientForSite } from '../../bitbucket/bbUtils';
import {
    Commit,
    PaginatedComments,
    PaginatedPullRequests,
    PullRequest,
    Task,
    type FileDiff,
} from '../../bitbucket/model';
import { Commands } from '../../commands';
import { Logger } from '../../logger';
import { Resources } from '../../resources';
import { AbstractBaseNode } from '../nodes/abstractBaseNode';
import { CommitSectionNode } from '../nodes/commitSectionNode';
import { RelatedBitbucketIssuesNode } from '../nodes/relatedBitbucketIssuesNode';
import { RelatedIssuesNode } from '../nodes/relatedIssuesNode';
import { SimpleNode } from '../nodes/simpleNode';
import { createFileChangesNodes, PRDirectory } from './diffViewHelper';
import { DirectoryNode } from '../nodes/directoryNode';
import { GitContentProvider } from '../gitContentProvider';
import { Container } from 'src/container';
import { PullRequestNodeDataProvider } from '../pullRequestNodeDataProvider';
import * as crypto from 'crypto';

export const PullRequestContextValue = 'pullrequest';
export class PullRequestTitlesNode extends AbstractBaseNode {
    private treeItem: vscode.TreeItem;
    public prHref: string;
    private loadedChildren: AbstractBaseNode[] = [];
    private isLoading = false;
    private parsedDiffCache: Map<string, any> = new Map();

    constructor(
        private pr: PullRequest,
        shouldPreload: boolean,
        parent: AbstractBaseNode | undefined,
    ) {
        super(parent);
        this.treeItem = this.createTreeItem();
        this.prHref = pr.data!.url;
        pr.titleNode = this;

        //If the PR node belongs to a server repo, we don't want to preload it because we can't cache nodes based on update times.
        //BBServer update times omit actions like comments, task creation, etc. so we don't know if the PR we have is really up to date without
        //grabbing all the PR data. Due to rate limits imposed by BBServer admins, mass preloading of all nodes is not feasible without
        //caching.
        if (shouldPreload) {
            this.fetchDataAndProcessChildren();
        }
    }

    private createTreeItem(): vscode.TreeItem {
        const approvalText = this.pr.data.participants
            .filter((p) => p.status === 'APPROVED')
            .map((approver) => `Approved-by: ${approver.displayName}`)
            .join('\n');

        const item = new vscode.TreeItem(
            `#${this.pr.data.id!} ${this.pr.data.title!}`,
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.tooltip = `#${this.pr.data.id!} ${this.pr.data.title!}${
            approvalText.length > 0 ? `\n\n${approvalText}` : ''
        }`;
        item.iconPath = vscode.Uri.parse(this.pr.data!.author!.avatarUrl);
        item.contextValue = PullRequestContextValue;
        item.resourceUri = vscode.Uri.parse(this.pr.data.url);
        let dateString = '';
        if (typeof this.pr.data.updatedTs === 'number') {
            dateString = formatDistanceToNow(new Date(this.pr.data.updatedTs), {
                addSuffix: true,
            });
        } else {
            dateString = formatDistanceToNow(parseISO(this.pr.data.updatedTs), {
                addSuffix: true,
            });
        }
        item.description = `updated ${dateString}`;

        return item;
    }

    getTreeItem(): vscode.TreeItem {
        return this.treeItem;
    }

    getParsedCache() {
        return this.parsedDiffCache;
    }

    getPR() {
        return this.pr;
    }

    refresh(): void {
        vscode.commands.executeCommand(Commands.RefreshPullRequestExplorerNode, this.treeItem.resourceUri);
    }

    async criticalData(
        criticalPromise: Promise<[FileDiff[], PaginatedComments]>,
        rootDirectory: DirectoryNode,
    ): Promise<[FileDiff[], PaginatedComments, AbstractBaseNode[]]> {
        let fileChangedNodes: AbstractBaseNode[] = [];
        let files: FileDiff[] = [];
        let comments: PaginatedComments = { data: [] };
        try {
            [files, comments] = await criticalPromise;
            Logger.debug('Fetched files and comments', files, comments);
            fileChangedNodes = await createFileChangesNodes(this.pr, comments, files, [], []);

            // Update existing rootDirectory instead of creating new one
            rootDirectory.getChildren = async () => fileChangedNodes;
        } catch (error) {
            Logger.debug('error fetching pull request details', error);
            this.loadedChildren = [new SimpleNode('⚠️ Error: fetching pull request details failed')];
            this.isLoading = false;
        }
        return [files, comments, fileChangedNodes];
    }

    async nonCriticalData(
        nonCriticalPromise: Promise<[string[], Task[]]>,
        fileDiffs: FileDiff[],
        allComments: PaginatedComments,
        commits: Commit[],
        rootDirectory: DirectoryNode,
    ): Promise<void> {
        try {
            const [conflictedFiles, tasks] = await nonCriticalPromise;
            Logger.debug('Fetched conflicted files and tasks', conflictedFiles, tasks);
            const [jiraIssueNodes, bbIssueNodes, fileNodes] = await Promise.all([
                this.createRelatedJiraIssueNode(commits, allComments),
                this.createRelatedBitbucketIssueNode(commits, allComments),
                createFileChangesNodes(this.pr, allComments, fileDiffs, conflictedFiles, tasks),
            ]);

            // Update existing rootDirectory instead of creating new one
            rootDirectory.getChildren = async () => fileNodes;

            this.loadedChildren = [
                new DescriptionNode(this.pr, this),
                ...(this.pr.site.details.isCloud ? [new CommitSectionNode(this.pr, commits)] : []),
                ...jiraIssueNodes,
                ...bbIssueNodes,
                rootDirectory,
            ];
        } catch (error) {
            Logger.debug('error fetching additional pull request details', error);
        }
    }

    async fetchDataAndProcessChildren(): Promise<void> {
        if (this.isLoading || !this.pr) {
            return;
        }
        this.isLoading = true;

        // Create Files directory once
        const filesDirectory: PRDirectory = {
            name: 'Files',
            fullPath: '',
            files: [],
            subdirs: new Map<string, PRDirectory>(),
        };
        const rootDirectory = new DirectoryNode(filesDirectory, this.pr.data.url, 'files', this.pr);

        // Set initial state with empty Files directory
        this.loadedChildren = [new DescriptionNode(this.pr, this), rootDirectory, new SimpleNode('Loading...')];
        this.refresh(); // Show initial structure

        try {
            const bbApi = await clientForSite(this.pr.site);

            // Fetch data
            const criticalPromise = Promise.all([
                bbApi.pullrequests.getChangedFiles(this.pr),
                bbApi.pullrequests.getComments(this.pr),
            ]);
            const commitsPromise = bbApi.pullrequests.getCommits(this.pr);
            const nonCriticalPromise = Promise.all([
                bbApi.pullrequests.getConflictedFiles(this.pr),
                bbApi.pullrequests.getTasks(this.pr),
            ]);

            // Process critical data
            const [fileDiffs, allComments] = await this.criticalData(criticalPromise, rootDirectory);
            const commits = await commitsPromise;
            const gitContentProvider = new GitContentProvider(Container.bitbucketContext);

            const fileHashPromises = fileDiffs.map(async (fileDiff) => {
                const rhsUri = vscode.Uri.parse(
                    `${PullRequestNodeDataProvider.SCHEME}://${fileDiff.newPath || ''}`,
                ).with({
                    query: JSON.stringify({
                        site: this.pr.site,
                        commitHash: this.pr.data.source.commitHash,
                        path: fileDiff.newPath,
                    }),
                });
                const [rhsContent] = await Promise.all([
                    gitContentProvider.provideTextDocumentContent(rhsUri, new vscode.CancellationTokenSource().token),
                ]);
                Logger.debug('Fetched file content', rhsContent);
                const contentHash = crypto.createHash('md5').update(`${rhsContent}`).digest('hex');
                return {
                    ...fileDiff,
                    contentHash,
                };
            });
            const filesWithHashes = await Promise.all(fileHashPromises);

            // Update children list without recreating Files directory
            this.loadedChildren = [
                new DescriptionNode(this.pr, this),
                ...(this.pr.site.details.isCloud ? [new CommitSectionNode(this.pr, commits)] : []),
                rootDirectory,
            ];
            this.refresh();

            // Process non-critical data
            await this.nonCriticalData(nonCriticalPromise, filesWithHashes, allComments, commits, rootDirectory);
        } catch (error) {
            Logger.debug('error fetching pull request details', error);
            this.loadedChildren = [new SimpleNode('⚠️ Error: fetching pull request details failed')];
        } finally {
            this.isLoading = false;
            this.refresh();
        }
    }

    async getChildren(element?: AbstractBaseNode): Promise<AbstractBaseNode[]> {
        if (element) {
            return element.getChildren();
        }
        if (!this.loadedChildren.length && !this.isLoading) {
            this.fetchDataAndProcessChildren();
        }
        return this.loadedChildren;
    }

    private async createRelatedJiraIssueNode(
        commits: Commit[],
        allComments: PaginatedComments,
    ): Promise<AbstractBaseNode[]> {
        const result: AbstractBaseNode[] = [];
        const relatedIssuesNode = await RelatedIssuesNode.create(this.pr, commits, allComments.data);
        if (relatedIssuesNode) {
            result.push(relatedIssuesNode);
        }
        return result;
    }

    private async createRelatedBitbucketIssueNode(
        commits: Commit[],
        allComments: PaginatedComments,
    ): Promise<AbstractBaseNode[]> {
        const result: AbstractBaseNode[] = [];
        const relatedIssuesNode = await RelatedBitbucketIssuesNode.create(this.pr, commits, allComments.data);
        if (relatedIssuesNode) {
            result.push(relatedIssuesNode);
        }
        return result;
    }
}

export class DescriptionNode extends AbstractBaseNode {
    constructor(
        private pr: PullRequest,
        parent?: AbstractBaseNode | undefined,
    ) {
        super(parent);
    }

    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem('Details', vscode.TreeItemCollapsibleState.None);
        item.tooltip = 'Open pull request details';
        item.iconPath = Resources.icons.get('detail');

        item.command = {
            command: Commands.BitbucketShowPullRequestDetails,
            title: 'Open pull request details',
            arguments: [this.pr],
        };

        item.contextValue = PullRequestContextValue;
        item.resourceUri = vscode.Uri.parse(this.pr.data.url);

        return item;
    }

    async getChildren(element?: AbstractBaseNode): Promise<AbstractBaseNode[]> {
        return [];
    }
}

export class NextPageNode extends AbstractBaseNode {
    constructor(private prs: PaginatedPullRequests) {
        super();
    }

    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem('Load next page', vscode.TreeItemCollapsibleState.None);
        item.iconPath = Resources.icons.get('more');

        item.command = {
            command: Commands.BitbucketPullRequestsNextPage,
            title: 'Load pull requests next page',
            arguments: [this.prs],
        };

        return item;
    }

    async getChildren(element?: AbstractBaseNode): Promise<AbstractBaseNode[]> {
        return [];
    }
}
