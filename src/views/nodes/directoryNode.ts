import * as vscode from 'vscode';
import { PRDirectory } from '../pullrequest/diffViewHelper';
import { AbstractBaseNode } from './abstractBaseNode';
import { PullRequestFilesNode } from './pullRequestFilesNode';
import { Container } from 'src/container';
import { Logger } from 'src/logger';

export class DirectoryNode extends AbstractBaseNode {
    constructor(
        private directoryData: PRDirectory,
        private prUrl: string,
        private section: 'files' | 'commits' = 'files',
        private commitHash?: string,
    ) {
        super();
    }

    private _isDirectClick = false;

    get directoryId(): string {
        const prUrlPath = vscode.Uri.parse(this.prUrl).path;
        const prId = prUrlPath.slice(prUrlPath.lastIndexOf('/') + 1);
        const repoUrl = this.prUrl.slice(0, this.prUrl.indexOf('/pull-requests'));
        const repoId = repoUrl.slice(repoUrl.lastIndexOf('/') + 1);
        const dirPath = this.directoryData.fullPath;

        if (this.directoryData.treeHash) {
            return `repo-${repoId}-pr-${prId}-${this.section}-${this.commitHash || 'main'}-tree-${this.directoryData.treeHash}`;
        }
        return `repo-${repoId}-pr-${prId}-${this.section}-${this.commitHash || 'main'}-directory-${dirPath}`;
    }

    private areAllChildrenChecked(): boolean {
        const allFilesChecked = this.directoryData.files.every((file) => {
            const fileNode = new PullRequestFilesNode(file, this.section, this.commitHash);
            return fileNode.checked;
        });

        const allSubdirsChecked = Array.from(this.directoryData.subdirs.values()).every((subdir) => {
            const subdirNode = new DirectoryNode(subdir, this.prUrl, this.section, this.commitHash);
            return subdirNode.checked;
        });

        return allFilesChecked && allSubdirsChecked;
    }

    set checked(value: boolean) {
        Logger.debug(`Setting directory ${this.directoryId} checked state to ${value}`);
        Container.checkboxStateManager.setChecked(this.directoryId, value);
        if (this._isDirectClick) {
            Logger.debug('Propagating state to children');
            this.directoryData.files.forEach((file) => {
                const fileNode = new PullRequestFilesNode(file, this.section, this.commitHash);
                Container.checkboxStateManager.setChecked(fileNode.fileId, value);
            });
            this.directoryData.subdirs.forEach((subdir) => {
                const subdirNode = new DirectoryNode(subdir, this.prUrl, this.section, this.commitHash);
                Container.checkboxStateManager.setChecked(subdirNode.directoryId, value);
            });
        }
    }
    get checked(): boolean {
        return Container.checkboxStateManager.isChecked(this.directoryId);
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        // For root files folder we do not want to show a checkbox and we want to show the folder icon and we do not want it expanded
        const isRootFilesDirectory =
            this.section === 'files' && this.directoryData.name === 'Files' && this.directoryData.fullPath === '';

        const item = new vscode.TreeItem(
            this.directoryData.name,
            isRootFilesDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded,
        );
        item.tooltip = this.directoryData.name;

        if (!isRootFilesDirectory) {
            item.iconPath = vscode.ThemeIcon.Folder;
        }

        const allChecked = this.areAllChildrenChecked();
        if (!this._isDirectClick) {
            Container.checkboxStateManager.setChecked(this.directoryId, allChecked);
        }

        if (!isRootFilesDirectory) {
            item.checkboxState = this.checked
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked;
            item.contextValue = `directory${allChecked ? '.checked' : ''}`;
        }

        item.id = this.directoryId;

        return item;
    }

    async getChildren(): Promise<AbstractBaseNode[]> {
        const fileNodes: AbstractBaseNode[] = this.directoryData.files.map(
            (diffViewArg) => new PullRequestFilesNode(diffViewArg, this.section, this.commitHash),
        );

        const directoryNodes: DirectoryNode[] = Array.from(
            this.directoryData.subdirs.values(),
            (subdir) => new DirectoryNode(subdir, this.prUrl, this.section, this.commitHash),
        );

        return [...fileNodes, ...directoryNodes];
    }
}
