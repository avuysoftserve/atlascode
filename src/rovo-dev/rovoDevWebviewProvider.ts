import path from 'path';
import { getHtmlForView } from 'src/webview/common/getHtmlForView';
import {
    CancellationToken,
    Disposable,
    Uri,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
    window,
} from 'vscode';

import { FetchPayload, FetchResponseData } from './utils';

export class RovoDevWebviewProvider extends Disposable implements WebviewViewProvider {
    private readonly viewType = 'atlascodeRovoDev';
    private _webView?: Webview;

    private _disposables: Disposable[] = [];

    constructor(private extensionPath: string) {
        super(() => {
            this._dispose();
        });
        // Register the webview view provider
        this._disposables.push(
            window.registerWebviewViewProvider('atlascode.views.rovoDev.webView', this, {
                webviewOptions: { retainContextWhenHidden: true },
            }),
        );
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken,
    ): Thenable<void> | void {
        this._webView = webviewView.webview;

        this._webView.options = {
            enableCommandUris: true,
            enableScripts: true,
            localResourceRoots: [Uri.file(path.join(this.extensionPath, 'build'))],
        };

        this._webView.html = getHtmlForView(
            this.extensionPath,
            webviewView.webview.asWebviewUri(Uri.file(this.extensionPath)),
            webviewView.webview.cspSource,
            this.viewType,
        );

        this._webView.onDidReceiveMessage(async (e) => {
            switch (e.type) {
                case 'prompt':
                    await this.processPromptMessage(e.text);
                    break;
            }
        });
    }

    private async processPromptMessage(message: string) {
        const url = 'http://localhost:8899/v2/chat';

        const payload: FetchPayload = {
            message: message,
        };

        if (!this._webView) {
            console.error('Webview is not initialized.');
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    accept: 'text/event-stream',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data:')) {
                        try {
                            const data: FetchResponseData = JSON.parse(trimmed.substring(5).trim());
                            await this._webView.postMessage({
                                type: 'response',
                                dataObject: data,
                            });
                        } catch (err) {
                            // Ignore JSON parse errors for incomplete lines
                            console.error('Error parsing JSON from response:', err);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            await this._webView.postMessage({
                type: 'response',
                text: `Error: ${error.message}`,
            });
        }
    }

    private _dispose() {
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];
        if (this._webView) {
            this._webView = undefined;
        }
    }

    async invoke(prompt: string): Promise<void> {
        // Send something to the webview to display the user's prompt
        if (!this._webView) {
            console.error('Webview is not initialized.');
            return;
        }

        await this._webView.postMessage({
            type: 'invokeData',
            prompt,
        });

        // Actually invoke the rovodev service, feed responses to the webview as normal
        await this.processPromptMessage(prompt);
    }
}
