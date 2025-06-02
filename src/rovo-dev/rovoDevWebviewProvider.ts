import path from 'path';
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
                    webviewView.webview.postMessage({
                        type: 'response',
                        text: `${message}??? I don't know, I'm not that intelligent.`,
                    });
                    break;
            }
        });
    }
}
