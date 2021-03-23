// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as global from "./global";
import * as client from "./client";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // create work dir
    global.setContext(context);
    if (!fs.existsSync(context.globalStoragePath)) {
        fs.mkdirSync(context.globalStoragePath);
    }

    // creat status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "QQ";
    statusBarItem.command = "oicq.statusBar.click";
    statusBarItem.show();
    vscode.commands.registerCommand("oicq.statusBar.click", client.invoke);
}

// this method is called when your extension is deactivated
export function deactivate() { }
