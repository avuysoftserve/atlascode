import path from 'path';
import * as vscode from 'vscode';
import { FileStatus, PullRequest } from '../../bitbucket/model';
import { Commands } from '../../commands';
import { configuration } from '../../config/configuration';
import { Resources } from '../../resources';
import { DiffViewArgs } from '../pullrequest/diffViewHelper';
import { PullRequestContextValue } from '../pullrequest/pullRequestNode';
import { AbstractBaseNode } from './abstractBaseNode';
import { Container } from '../../container';
import { DirectoryNode } from './directoryNode';
export class PullRequestFilesNode extends AbstractBaseNode {
    constructor(
        private diffViewData: DiffViewArgs,
        private section: 'files' | 'commits' = 'files',
        private pr: PullRequest,
        private commitHash?: string,
        private lastCommitHash: string = '',
    ) {
        super();
    }

    get getLastCommitHash(): string {
        return this.lastCommitHash;
    }

    get fileId(): string {
        const prUrl = this.pr.data.url;
        const repoUrl = prUrl.slice(0, prUrl.indexOf('/pull-requests'));
        const repoId = repoUrl.slice(repoUrl.lastIndexOf('/') + 1);

        if (this.section === 'commits') {
            return `repo-${repoId}-pr-${this.pr.data.id}-section-${this.section}-commit-${this.commitHash}-file-${this.diffViewData.blobHash}`;
        }
        return `repo-${repoId}-pr-${this.pr.data.id}-section-${this.section}-file-${this.diffViewData.blobHash}`;
    }

    get checked(): boolean {
        return Container.checkboxStateManager.isChecked(this.fileId);
    }

    set checked(value: boolean) {
        Container.checkboxStateManager.setChecked(this.fileId, value);

        if (this.getParent instanceof DirectoryNode) {
            this.getTreeItem();
        }
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

        item.checkboxState = this.checked
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;

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
