import * as fs from 'fs';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const provider = new GIFPlayerPanelProvider(context, context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'pixel-art-player.view',
			provider
		)
	);
}

class GIFPlayerPanelProvider implements vscode.WebviewViewProvider {
	private _currentImageIndex: number = 0;
	private _gifFiles: string[] = [];

	constructor(
		private readonly _extensionContext: vscode.ExtensionContext,
		private readonly _extensionUri: vscode.Uri,
	) {
		// Load GIF files from the media folder
		const mediaPath = vscode.Uri.joinPath(this._extensionUri, 'media');
		this._gifFiles = fs.readdirSync(mediaPath.fsPath).filter(file => file.endsWith('.gif'));

		// Retrieve the last saved index from the global state
		this._currentImageIndex = this._extensionContext.globalState.get('currentImageIndex') || 0;
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

		// Restore webview from state when visibility changes
		webviewView.onDidChangeVisibility(
			() => {
				// Retrieve the last saved index from the global state
				this._currentImageIndex = this._extensionContext.globalState.get('currentImageIndex') || 0;
				// Re-render the webview
				this.renderWebview(webviewView);
			}
		);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(message => {
			switch (message.type) {
				case 'imageClicked':
					// Switch to the next GIF when the image is clicked
					this.switchToNextImage(webviewView);
					break;
				case 'imageRightClicked':
					// Switch to the previous GIF when the image is right clicked
					this.switchToPreviousImage(webviewView);
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
		this.saveCurrentImageIndex();
	}

	private switchToPreviousImage(webviewView: vscode.WebviewView) {
		this._currentImageIndex = (this._currentImageIndex - 1 + this._gifFiles.length) % this._gifFiles.length;
		const mediaUri = this.getImageUri(webviewView, this._currentImageIndex);
		webviewView.webview.postMessage({ type: 'updateImage', uri: mediaUri.toString() });
		this.saveCurrentImageIndex();
	}

	private getImageUri(webviewView: vscode.WebviewView, index: number): vscode.Uri {
		return webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', this._gifFiles[index]));
	}

	private saveCurrentImageIndex() {
		this._extensionContext.globalState.update('currentImageIndex', this._currentImageIndex);
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

				// Attach click event listener to the image
				document.getElementById('gif').addEventListener(
					'click',
					() => vscode.postMessage({ type: 'imageClicked' })
				);

				// Attach right click event listener to the image
				document.getElementById('gif').addEventListener(
					'contextmenu',
					(e) => {
						e.preventDefault();
						vscode.postMessage({ type: 'imageRightClicked' })
					}
				);

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
