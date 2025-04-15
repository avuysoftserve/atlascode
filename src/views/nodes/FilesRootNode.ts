import * as vscode from 'vscode';
import { AbstractBaseNode } from './abstractBaseNode';
import { Resources } from 'src/resources';

export class FilesRootNode extends AbstractBaseNode {
    constructor(
        private fileNodes: AbstractBaseNode[],
        parent?: AbstractBaseNode,
    ) {
        super(parent);
    }

    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem('Files', vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = Resources.icons.get('file'); // use an appropriate icon
        item.contextValue = 'files-root';
        return item;
    }

    async getChildren(): Promise<AbstractBaseNode[]> {
        return this.fileNodes;
    }
}