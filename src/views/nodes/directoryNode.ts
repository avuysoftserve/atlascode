import * as vscode from 'vscode';
import { PRDirectory } from '../pullrequest/diffViewHelper';
import { AbstractBaseNode } from './abstractBaseNode';
import { PullRequestFilesNode } from './pullRequestFilesNode';
import { Container } from 'src/container';
import { Logger } from 'src/logger';
import { PullRequest } from 'src/bitbucket/model';
export class DirectoryNode extends AbstractBaseNode {
    constructor(
        private directoryData: PRDirectory,
        private prUrl: string,
        private section: 'files' | 'commits' = 'files',
        private pr: PullRequest,
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

        if (this.section === 'commits') {
            return `repo-${repoId}-pr-${prId}-section-${this.section}-commit-${this.commitHash}-directory-${dirPath}`;
        }
        return `repo-${repoId}-pr-${prId}-section-${this.section}-${dirPath}`;
    }

    private areAllChildrenChecked(): boolean {
        const allFilesChecked = this.directoryData.files.every((file) => {
            const fileNode = new PullRequestFilesNode(file, this.section, this.pr, this.commitHash);
            return fileNode.checked;
        });

        const allSubdirsChecked = Array.from(this.directoryData.subdirs.values()).every((subdir) => {
            const subdirNode = new DirectoryNode(subdir, this.prUrl, this.section, this.pr, this.commitHash);
            return subdirNode.checked;
        });

        return allFilesChecked && allSubdirsChecked;
    }

    // private updateParentDirectories() {
    //     // Get parent directory path
    //     const parentPath = path.dirname(this.directoryData.fullPath);
    //     if (parentPath && parentPath !== '.') {
    //         // Create parent directory node and update its state
    //         const parentDir = new DirectoryNode(
    //             // Create parent directory data
    //             {
    //                 name: path.basename(parentPath),
    //                 fullPath: parentPath,
    //                 files: [],
    //                 subdirs: new Map(),
    //             },
    //             this.prUrl,
    //             this.section,
    //             this.pr,
    //             this.commitHash,
    //         );
    //         // Update parent state based on all its children
    //         const parentChecked = parentDir.areAllChildrenChecked();
    //         parentDir.checked = parentChecked;
    //     }
    // }

    set checked(value: boolean) {
        // Don't proceed if we're already in a propagation
        if (this._isDirectClick) {
            return;
        }
        try {
            this._isDirectClick = true; // Set flag BEFORE any operations
            Logger.debug(`Setting directory ${this.directoryId} checked state to ${value}`);
            // Update this directory's state
            Container.checkboxStateManager.setChecked(this.directoryId, value);
            // Propagate to children
            Logger.debug('Propagating state to children');
            this.directoryData.files.forEach((file) => {
                const fileNode = new PullRequestFilesNode(file, this.section, this.pr, this.commitHash);
                Container.checkboxStateManager.setChecked(fileNode.fileId, value);
            });
            this.directoryData.subdirs.forEach((subdir) => {
                const subdirNode = new DirectoryNode(subdir, this.prUrl, this.section, this.pr, this.commitHash);
                Container.checkboxStateManager.setChecked(subdirNode.directoryId, value);
            });
        } finally {
            this._isDirectClick = false; // Always reset the flag
        }
    }

    get checked(): boolean {
        // First check if this directory has an explicit state
        const hasExplicitState = Container.checkboxStateManager.isChecked(this.directoryId);
        // If no explicit state, derive from children
        if (!hasExplicitState) {
            return this.areAllChildrenChecked();
        }
        return hasExplicitState;
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
            (diffViewArg) => new PullRequestFilesNode(diffViewArg, this.section, this.pr, this.commitHash),
        );

        const directoryNodes: DirectoryNode[] = Array.from(
            this.directoryData.subdirs.values(),
            (subdir) => new DirectoryNode(subdir, this.prUrl, this.section, this.pr, this.commitHash),
        );

        return [...directoryNodes, ...fileNodes];
    }
}
