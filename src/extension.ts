import * as fs from 'fs';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const provider = new GIFPlayerPanelProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'pixel-art-player.view',
			provider
		)
	);
}

class GIFPlayerPanelProvider implements vscode.WebviewViewProvider {
	private _currentImageIndex = 0;
	private _gifFiles: string[] = [];

	constructor(private readonly _extensionUri: vscode.Uri) {
		// Load GIF files from the media folder
		const mediaPath = vscode.Uri.joinPath(this._extensionUri, 'media');
		this._gifFiles = fs.readdirSync(mediaPath.fsPath).filter(file => file.endsWith('.gif'));
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		// Render the webview with the first GIF
		this.renderWebview(webviewView);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(message => {
			switch (message.type) {
				case 'imageClicked':
					// Switch to the next GIF when the image is clicked
					this.switchToNextImage(webviewView);
					break;
			}
		});
	}

	private renderWebview(webviewView: vscode.WebviewView) {
		const mediaUri = this.getImageUri(webviewView, this._currentImageIndex);
		webviewView.webview.html = getWebviewContent(mediaUri);
	}

	private switchToNextImage(webviewView: vscode.WebviewView) {
		this._currentImageIndex = (this._currentImageIndex + 1) % this._gifFiles.length;
		const mediaUri = this.getImageUri(webviewView, this._currentImageIndex);
		webviewView.webview.postMessage({ type: 'updateImage', uri: mediaUri.toString() });
	}

	private getImageUri(webviewView: vscode.WebviewView, index: number): vscode.Uri {
		return webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', this._gifFiles[index]));
	}
}

function getWebviewContent(mediaUri: vscode.Uri) {
	return `<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>GIF Player</title>
			<style>
				body {
					margin: 0;
					padding: 0;
					overflow: hidden;
				}
				img {
					width: 100%;
					height: 100%;
					cursor: pointer;
				}
			</style>
		</head>
		<body>
			<img id="gif" src="${mediaUri}" alt="GIF">
			<script>
				const vscode = acquireVsCodeApi();

				function imageClicked() {
					// Send message to extension when image is clicked
					vscode.postMessage({ type: 'imageClicked' });
				}

				// Attach click event listener to the image
				document.getElementById('gif').addEventListener('click', imageClicked);

				// Listen for messages from the extension
				window.addEventListener('message', event => {
					const message = event.data;
					if (message.type === 'updateImage') {
						const img = document.getElementById('gif');
						img.src = message.uri;
					}
				});
			</script>
		</body>
	</html>`;
}

export function deactivate() {}
