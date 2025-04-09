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
    get directoryId(): string {
        const prUrlPath = vscode.Uri.parse(this.prUrl).path;
        const prId = prUrlPath.slice(prUrlPath.lastIndexOf('/') + 1);
        const repoUrl = this.prUrl.slice(0, this.prUrl.indexOf('/pull-requests'));
        const repoId = repoUrl.slice(repoUrl.lastIndexOf('/') + 1);
        const sectionPart = this.section === 'commits' ? `-commit-${this.commitHash || 'unknown'}` : '';
        Logger.debug(
            'DIRECTORY ID',
            `repo-${repoId}-pr-${prId}${sectionPart}-commit-${this.commitHash}-section-${this.section}-directory-${this.directoryData.name}`,
        );
        return `repo-${repoId}-pr-${prId}${sectionPart}-commit-${this.commitHash}-section-${this.section}-directory-${this.directoryData.name}`;
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

    get checked(): boolean {
        return Container.checkboxStateManager.isChecked(this.directoryId);
    }

    set checked(value: boolean) {
        Container.checkboxStateManager.setChecked(this.directoryId, value);

        // Only propagate to children if this is a direct directory checkbox click
        if (this._isDirectClick) {
            this.directoryData.files.forEach((file) => {
                const fileNode = new PullRequestFilesNode(file, this.section, this.commitHash);
                fileNode.checked = value;
            });

            this.directoryData.subdirs.forEach((subdir) => {
                const subdirNode = new DirectoryNode(subdir, this.prUrl, this.section, this.commitHash);
                subdirNode.checked = value;
            });
        }
    }

    private _isDirectClick = false;

    async getTreeItem(): Promise<vscode.TreeItem> {
        const item = new vscode.TreeItem(this.directoryData.name, vscode.TreeItemCollapsibleState.Expanded);
        item.tooltip = this.directoryData.name;
        item.iconPath = vscode.ThemeIcon.Folder;

        // Only update directory state without propagating to children
        const allChecked = this.areAllChildrenChecked();
        if (!this._isDirectClick) {
            Container.checkboxStateManager.setChecked(this.directoryId, allChecked);
        }

        item.checkboxState = allChecked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;

        item.id = this.directoryId;
        item.contextValue = `directory${allChecked ? '.checked' : ''}`;

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
