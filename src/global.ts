import * as vscode from 'vscode';
import * as oicq from 'oicq';

function setContext(context: vscode.ExtensionContext) {
    ctx = context;
}

function setClient(c: oicq.Client) {
    client = c;
}

var ctx: vscode.ExtensionContext;
var client: oicq.Client;

export { ctx, client, setContext, setClient };
