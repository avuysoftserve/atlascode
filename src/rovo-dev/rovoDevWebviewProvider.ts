import path from 'path';
import { Logger } from 'src/logger';
import { getHtmlForView } from 'src/webview/common/getHtmlForView';
import { CancellationToken, Uri, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from 'vscode';

export class RovoDevWebviewProvider implements WebviewViewProvider {
    private readonly viewType = 'atlascodeRovoDev';
    private _extensionPath: string;

    constructor(extensionPath: string) {
        this._extensionPath = extensionPath;

        // Register the webview view provider
        window.registerWebviewViewProvider('atlascode.views.rovoDev.webView', this, {
            webviewOptions: { retainContextWhenHidden: true },
        });
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken,
    ): Thenable<void> | void {
        webviewView.webview.options = {
            enableCommandUris: true,
            enableScripts: true,
            localResourceRoots: [Uri.file(path.join(this._extensionPath, 'build'))],
        };

        webviewView.webview.html = getHtmlForView(
            this._extensionPath,
            webviewView.webview.asWebviewUri(Uri.file(this._extensionPath)),
            webviewView.webview.cspSource,
            this.viewType,
        );

        webviewView.webview.onDidReceiveMessage((e) => {
            switch (e.type) {
                case 'prompt':
                    const message = e.text;
                    const url = 'http://localhost:8899/v2/chat';
                    const payload = {
                        message: message,
                    };

                    interface FetchPayload {
                        message: string;
                    }

                    interface FetchResponseData {
                        content?: string;
                    }

                    fetch(url, {
                        method: 'POST',
                        headers: {
                            accept: 'text/event-stream',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload as FetchPayload),
                    })
                        .then(async (response: Response) => {
                            const text: string = await response.text();
                            const lines: string[] = text.split('\n').filter((line: string) => line.trim() !== '');
                            for (const line of lines) {
                                Logger.debug(`Received line: ${line}`);
                                if (line.startsWith('data:')) {
                                    const data: FetchResponseData = JSON.parse(line.substring(5).trim());
                                    if (data.content) {
                                        await webviewView.webview.postMessage({
                                            type: 'response',
                                            text: data.content,
                                        });
                                    }
                                }
                            }
                        })
                        .catch((error: Error) => {
                            console.error('Error fetching data:', error);
                            webviewView.webview.postMessage({
                                type: 'response',
                                text: `Error: ${error.message}`,
                            });
                        });
                    break;
            }
        });
    }
}
