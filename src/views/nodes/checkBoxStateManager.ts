import vscode from 'vscode';

export class CheckboxStateManager {
    constructor(private context: vscode.ExtensionContext) {}

    private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    isChecked(fileId: string): boolean {
        const checkedFiles = this.context.workspaceState.get<string[]>('bitbucket.checkedFiles', []);
        return checkedFiles.includes(fileId);
    }

    setChecked(fileId: string, checked: boolean): void {
        const checkedFiles = this.context.workspaceState.get<string[]>('bitbucket.checkedFiles', []);

        if (checked && !checkedFiles.includes(fileId)) {
            checkedFiles.push(fileId);
            this.context.workspaceState.update('bitbucket.checkedFiles', checkedFiles);
        } else if (!checked && checkedFiles.includes(fileId)) {
            const updatedChecked = checkedFiles.filter((id) => id !== fileId);
            this.context.workspaceState.update('bitbucket.checkedFiles', updatedChecked);
        }
    }

    clearCheckedFiles(): void {
        this.context.workspaceState.update('bitbucket.checkedFiles', []);
    }
}
