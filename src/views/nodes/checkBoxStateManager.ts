import vscode from 'vscode';

export class CheckboxStateManager {
    private checkedStates: Set<string>;
    constructor(private context: vscode.ExtensionContext) {
        // Initialize from stored state
        const savedStates = this.context.workspaceState.get<string[]>('bitbucket.checkedFiles', []);
        this.checkedStates = new Set(savedStates);
    }
    setChecked(id: string, checked: boolean): void {
        if (checked) {
            this.checkedStates.add(id);
        } else {
            this.checkedStates.delete(id);
        }
        // Update storage immediately
        this.context.workspaceState.update('bitbucket.checkedFiles', Array.from(this.checkedStates));
    }
    isChecked(id: string): boolean {
        return this.checkedStates.has(id);
    }
    clearCheckedFiles(): void {
        this.checkedStates.clear();
        this.context.workspaceState.update('bitbucket.checkedFiles', []);
    }
}
