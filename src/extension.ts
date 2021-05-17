// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as global from "./global";
import * as client from "./client";
import { getConfig } from './config';
import { createClient } from 'oicq';

let timer: NodeJS.Timeout | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // create work dir
    global.setContext(context);
    if (!fs.existsSync(context.globalStorageUri.fsPath)) {
        fs.mkdirSync(context.globalStorageUri.fsPath);
    }
    if (!fs.existsSync(path.join(context.globalStorageUri.fsPath, "tmp"))) {
        fs.mkdirSync(path.join(context.globalStorageUri.fsPath, "tmp"));
    }

    if (!timer) {
        timer = setInterval(() => {
            if (global.client?.isOnline()) {
                fs.writeFile(path.join(global.client.dir, "online.lock"), "114514", () => { });
            }
        }, 5000);
    }

    // creat status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "QQ";
    statusBarItem.command = "oicq.statusBar.click";
    statusBarItem.show();
    vscode.commands.registerCommand("oicq.statusBar.click", client.invoke);
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}
