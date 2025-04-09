import * as vscode from 'vscode';
import { PRDirectory } from '../pullrequest/diffViewHelper';
import { AbstractBaseNode } from './abstractBaseNode';
import { PullRequestFilesNode } from './pullRequestFilesNode';
import { Container } from 'src/container';
import { Logger } from 'src/logger';
import { PullRequest, WorkspaceRepo } from 'src/bitbucket/model';

export class DirectoryNode extends AbstractBaseNode {
    constructor(
        private directoryData: PRDirectory,
        private prUrl: string,
        private section: 'files' | 'commits' = 'files',
        private commitHash?: string,
        private pr?: PullRequest,
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
            return `pr-${prId}-repo-${repoId}-${this.section}-${this.commitHash || 'main'}-tree-${this.directoryData.treeHash}`;
        }
        return `pr-${prId}-repo-${repoId}-${this.section}-${this.commitHash || 'main'}-directory-${dirPath}`;
    }

    async fetchGitHashes(): Promise<void> {
        if (this.pr?.workspaceRepo) {
            const workspaceRepo = Container.bitbucketContext.getRepository(
                vscode.Uri.parse(this.pr.workspaceRepo.rootUri),
            );
            if (workspaceRepo) {
                try {
                    // Get the Git extension API
                    const extension = vscode.extensions.getExtension('vscode.git');
                    if (!extension) {
                        throw new Error('Git extension not found');
                    }
                    if (!extension.isActive) {
                        await extension.activate();
                    }
                    const gitApi = extension.exports.getAPI(1);
                    // Find the VS Code repository instance
                    const repository = gitApi.repositories.find(
                        (repo: WorkspaceRepo) => repo.rootUri.toString() === workspaceRepo.rootUri,
                    );
                    if (repository) {
                        const result = await repository.exec([
                            'rev-parse',
                            `${this.commitHash || this.pr.data.source!.commitHash}:${this.directoryData.fullPath}`,
                        ]);
                        this.directoryData.treeHash = result.stdout.trim();
                    }
                } catch (e) {
                    Logger.debug('Error getting Git tree hash:', e);
                }
            }
        }
    }

    private areAllChildrenChecked(): boolean {
        const allFilesChecked = this.directoryData.files.every((file) => {
            const fileNode = new PullRequestFilesNode(file, this.section, this.commitHash, this.pr);
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
                const fileNode = new PullRequestFilesNode(file, this.section, this.commitHash, this.pr);
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
            (diffViewArg) => new PullRequestFilesNode(diffViewArg, this.section, this.commitHash, this.pr),
        );

        const directoryNodes: DirectoryNode[] = Array.from(
            this.directoryData.subdirs.values(),
            (subdir) => new DirectoryNode(subdir, this.prUrl, this.section, this.commitHash, this.pr),
        );

        return [...fileNodes, ...directoryNodes];
    }
}
