import { Logger } from 'src/logger';
import vscode from 'vscode';
interface CheckboxState {
    id: string;
    timestamp: number;
}
export class CheckboxStateManager {
    private readonly STATE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    private readonly STORAGE_KEY = 'bitbucket.viewedFiles';

    constructor(private context: vscode.ExtensionContext) {
        this.cleanup();
    }

    private async cleanup(): Promise<void> {
        const states = this.context.workspaceState.get<CheckboxState[]>(this.STORAGE_KEY, []);
        const now = Date.now();

        const validStates = states.filter((state) => {
            const isValid = now - state.timestamp < this.STATE_EXPIRY;
            if (!isValid) {
                Logger.debug(`Removing expired checkbox state: ${state.id}`);
            }
            return isValid;
        });

        await this.context.workspaceState.update(this.STORAGE_KEY, validStates);
        Logger.debug(`Cleanup complete. Remaining states: ${validStates.length}`);
    }

    isChecked(id: string): boolean {
        const states = this.context.workspaceState.get<CheckboxState[]>(this.STORAGE_KEY, []);
        const state = states.find((state) => state.id === id);

        if (state) {
            if (Date.now() - state.timestamp >= this.STATE_EXPIRY) {
                this.setChecked(id, false);
                return false;
            }
            return true;
        }
        return false;
    }

    setChecked(id: string, checked: boolean): void {
        const states = this.context.workspaceState.get<CheckboxState[]>(this.STORAGE_KEY, []);

        if (checked) {
            const existingIndex = states.findIndex((state) => state.id === id);
            if (existingIndex !== -1) {
                states.splice(existingIndex, 1);
            }
            states.push({ id, timestamp: Date.now() });
        } else {
            const index = states.findIndex((state) => state.id === id);
            if (index !== -1) {
                states.splice(index, 1);
            }
        }

        this.context.workspaceState.update(this.STORAGE_KEY, states);
        Logger.debug(`Checkbox state updated: ${id} = ${checked}`);
    }
}
