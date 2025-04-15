import * as vscode from 'vscode';
import { PRDirectory } from '../pullrequest/diffViewHelper';
import { AbstractBaseNode } from './abstractBaseNode';
import { PullRequestFilesNode } from './pullRequestFilesNode';
import { Container } from 'src/container';
import { Logger } from 'src/logger';
import { PullRequest } from 'src/bitbucket/model';
import * as crypto from 'crypto';

export class DirectoryNode extends AbstractBaseNode {
    isRootFilesDirectory: boolean | undefined;
    constructor(
        private directoryData: PRDirectory,
        private section: 'files' | 'commits' = 'files',
        private pr: PullRequest,
    ) {
        super();
    }

    private _isDirectClick = false;

    get directoryId(): string {
        const prUrl = this.pr.data.url;
        const prUrlPath = vscode.Uri.parse(prUrl).path;
        const prId = prUrlPath.slice(prUrlPath.lastIndexOf('/') + 1);
        const repoUrl = prUrl.slice(0, prUrl.indexOf('/pull-requests'));
        const repoId = repoUrl.slice(repoUrl.lastIndexOf('/') + 1);
        const dirPath = this.directoryData.dirPath;

        const dirId =
            this.section === 'commits'
                ? `repo-${repoId}-pr-${prId}-section-${this.section}-commit-${this.pr.data.source.commitHash}-directory-${dirPath}`
                : `repo-${repoId}-pr-${prId}-section-${this.section}-directory-${dirPath}`;
        return crypto.createHash('md5').update(dirId).digest('hex');
    }

    private areAllChildrenChecked(): boolean {
        const allFilesChecked = this.directoryData.files.every((file) => {
            const fileNode = new PullRequestFilesNode(file, this.section, this.pr);
            return fileNode.checked;
        });

        const allSubdirsChecked = Array.from(this.directoryData.subdirs.values()).every((subdir) => {
            const subdirNode = new DirectoryNode(subdir, this.section, this.pr);
            return subdirNode.checked;
        });

        return allFilesChecked && allSubdirsChecked;
    }

    set checked(value: boolean) {
        // This is to avoid infinite loops when setting the checked state
        if (this._isDirectClick) {
            return;
        }

        try {
            this._isDirectClick = true;
            Logger.debug(`Setting directory ${this.directoryId} checked state to ${value}`);
            Container.checkboxStateManager.setChecked(this.directoryId, value);

            Logger.debug('Propagating state to children');
            this.directoryData.files.forEach((file) => {
                const fileNode = new PullRequestFilesNode(file, this.section, this.pr);
                Container.checkboxStateManager.setChecked(fileNode.fileId, value);
            });
            this.directoryData.subdirs.forEach((subdir) => {
                const subdirNode = new DirectoryNode(subdir, this.section, this.pr);
                Container.checkboxStateManager.setChecked(subdirNode.directoryId, value);
            });
        } finally {
            this._isDirectClick = false;
        }
    }

    get checked(): boolean {
        const hasExplicitState = Container.checkboxStateManager.isChecked(this.directoryId);
        if (!hasExplicitState) {
            return this.areAllChildrenChecked();
        }
        return hasExplicitState;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        this.isRootFilesDirectory =
            this.section === 'files' && this.directoryData.name === 'Files' && this.directoryData.dirPath === '';

        const item = new vscode.TreeItem(
            this.directoryData.name,
            this.isRootFilesDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded,
        );
        item.tooltip = this.directoryData.name;

        if (!this.isRootFilesDirectory) {
            item.iconPath = vscode.ThemeIcon.Folder;
        }

        const allChecked = this.areAllChildrenChecked();

        if (!this.isRootFilesDirectory) {
            item.checkboxState = this.checked
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked;
            item.contextValue = `directory${allChecked ? '.checked' : ''}`;
        }

        Logger.debug('directoryId', this.directoryId);

        if (!this.isRootFilesDirectory) {
            item.id = this.directoryId;
        }

        return item;
    }

    async getChildren(): Promise<AbstractBaseNode[]> {
        const fileNodes: AbstractBaseNode[] = this.directoryData.files.map(
            (diffViewArg) => new PullRequestFilesNode(diffViewArg, this.section, this.pr),
        );

        const directoryNodes: DirectoryNode[] = Array.from(
            this.directoryData.subdirs.values(),
            (subdir) => new DirectoryNode(subdir, this.section, this.pr),
        );

        return [...directoryNodes, ...fileNodes];
    }
}
