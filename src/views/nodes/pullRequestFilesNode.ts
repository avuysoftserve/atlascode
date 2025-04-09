import path from 'path';
import * as vscode from 'vscode';
import { FileStatus, PullRequest, WorkspaceRepo } from '../../bitbucket/model';
import { Commands } from '../../commands';
import { configuration } from '../../config/configuration';
import { Resources } from '../../resources';
import { DiffViewArgs } from '../pullrequest/diffViewHelper';
import { PullRequestContextValue } from '../pullrequest/pullRequestNode';
import { AbstractBaseNode } from './abstractBaseNode';
import { Container } from '../../container';
import { Logger } from 'src/logger';

export class PullRequestFilesNode extends AbstractBaseNode {
    constructor(
        private diffViewData: DiffViewArgs,
        private section: 'files' | 'commits' = 'files',
        private commitHash?: string,
        private pr?: PullRequest, // Add PR parameter
    ) {
        super();
    }

    get fileId(): string {
        const prUrl = this.diffViewData.fileDisplayData.prUrl;
        const prUrlPath = vscode.Uri.parse(prUrl).path;
        const prId = prUrlPath.slice(prUrlPath.lastIndexOf('/') + 1);
        const repoUrl = prUrl.slice(0, prUrl.indexOf('/pull-requests'));
        const repoId = repoUrl.slice(repoUrl.lastIndexOf('/') + 1);
        const filePath = this.diffViewData.fileDisplayData.fileDisplayName;

        if (this.diffViewData.blobHash) {
            return `pr-${prId}-repo-${repoId}-${this.section}-${this.commitHash || 'main'}-blob-${this.diffViewData.blobHash}`;
        }
        return `pr-${prId}-repo-${repoId}-${this.section}-${this.commitHash || 'main'}-file-${filePath}`;
    }


    async fetchGitHash(): Promise<void> {
        if (this.pr?.workspaceRepo) {
            const workspaceRepo = Container.bitbucketContext.getRepository(
                vscode.Uri.parse(this.pr.workspaceRepo.rootUri),
            );
            if (workspaceRepo) {
                try {
                    const extension = vscode.extensions.getExtension('vscode.git');
                    if (!extension) {
                        throw new Error('Git extension not found');
                    }
                    if (!extension.isActive) {
                        await extension.activate();
                    }
                    const gitApi = extension.exports.getAPI(1);
                    const repository = gitApi.repositories.find(
                        (repo: WorkspaceRepo) => repo.rootUri.toString() === workspaceRepo.rootUri,
                    );
                    if (repository) {
                        const result = await repository.exec([
                            'rev-parse',
                            `${this.commitHash || this.pr.data.source!.commitHash}:${this.diffViewData.fileDisplayData.fileDisplayName}`,
                        ]);
                        this.diffViewData.blobHash = result.stdout.trim();
                    }
                } catch (e) {
                    Logger.debug('Error getting Git blob hash:', e);
                }
            }
        }
    }

    // Use the Container's checkbox manager
    get checked(): boolean {
        return Container.checkboxStateManager.isChecked(this.fileId);
    }

    set checked(value: boolean) {
        Container.checkboxStateManager.setChecked(this.fileId, value);
    }

    get getDiffViewData(): DiffViewArgs {
        return this.diffViewData;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const itemData = this.diffViewData.fileDisplayData;
        let fileDisplayString = itemData.fileDisplayName;
        if (configuration.get<boolean>('bitbucket.explorer.nestFilesEnabled')) {
            fileDisplayString = path.basename(itemData.fileDisplayName);
        }

        const item = new vscode.TreeItem(
            `${itemData.numberOfComments > 0 ? '💬 ' : ''}${fileDisplayString}`,
            vscode.TreeItemCollapsibleState.None,
        );

        // Set checkbox state based on persisted state
        item.checkboxState = this.checked
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;

        // Set unique id for the tree item
        item.id = this.fileId;

        item.tooltip = itemData.fileDisplayName;
        item.command = {
            command: Commands.ViewDiff,
            title: 'Diff file',
            arguments: this.diffViewData.diffArgs,
        };

        item.contextValue = `${PullRequestContextValue}${this.checked ? '.checked' : ''}`;
        item.resourceUri = vscode.Uri.parse(`${itemData.prUrl}#chg-${itemData.fileDisplayName}`);

        switch (itemData.fileDiffStatus) {
            case FileStatus.ADDED:
                item.iconPath = Resources.icons.get('add-circle');
                break;
            case FileStatus.DELETED:
                item.iconPath = Resources.icons.get('delete');
                break;
            case FileStatus.CONFLICT:
                item.iconPath = Resources.icons.get('warning');
                break;
            default:
                item.iconPath = Resources.icons.get('edit');
                break;
        }

        if (this.diffViewData.fileDisplayData.isConflicted) {
            item.iconPath = Resources.icons.get('warning');
        }

        return item;
    }

    async getChildren(element?: AbstractBaseNode): Promise<AbstractBaseNode[]> {
        return [];
    }
}
