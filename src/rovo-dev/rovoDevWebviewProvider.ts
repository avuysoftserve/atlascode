import path from 'path';
//import { Logger } from 'src/logger';
import { getHtmlForView } from 'src/webview/common/getHtmlForView';
import { CancellationToken, Uri, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from 'vscode';

export class RovoDevWebviewProvider implements WebviewViewProvider {
    private readonly viewType = 'atlascodeRovoDev';

    constructor(private extensionPath: string) {
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
            localResourceRoots: [Uri.file(path.join(this.extensionPath, 'build'))],
        };

        webviewView.webview.html = getHtmlForView(
            this.extensionPath,
            webviewView.webview.asWebviewUri(Uri.file(this.extensionPath)),
            webviewView.webview.cspSource,
            this.viewType,
        );

        webviewView.webview.onDidReceiveMessage(async (e) => {
            switch (e.type) {
                case 'prompt':
                    await this.processPromptMessage(webviewView, e);
                    break;
            }
        });
    }

    private async processPromptMessage(webviewView: WebviewView, e: any) {
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

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    accept: 'text/event-stream',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload as FetchPayload),
            });

            const text: string = await response.text();
            const lines: string[] = text.split('\n').filter((line: string) => line.trim() !== '');
            for (const line of lines) {
                //Logger.debug(`Received line: ${line}`);
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
        } catch (error) {
            console.error('Error fetching data:', error);
            await webviewView.webview.postMessage({
                type: 'response',
                text: `Error: ${error.message}`,
            });
        }
    }
}
