import * as vscode from 'vscode';
import * as oicq from 'oicq';

export class ChatDocumentContentProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri): string {
		return "" + Math.random();
	}
};
