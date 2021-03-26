import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { refreshContacts } from "./explorer";
import { client, ctx, genContactId, parseContactId } from "./global";

interface WebViewPostData {
    command?: keyof oicq.Client,
    params?: any[],
    echo?: string,
}

vscode.commands.registerCommand("oicq.c2c.open", openChatView);
vscode.commands.registerCommand("oicq.group.open", openChatView);

const webviewMap: Map<string, vscode.WebviewPanel> = new Map;
let html = "";

function getHtml(webview: vscode.Webview) {
    if (!html) {
        html = fs.readFileSync(path.join(ctx.extensionPath, "assets", "chat.html"), { encoding: "utf-8" });
    }
    const litewebchat = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", "litewebchat.min.css"));
    const jquery = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", "jquery.min.js"));
    const moment = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", "moment.min.js"));
    const app = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", "app.js"));
    return html
        .replace("{litewebchat.min.css}", litewebchat.toString())
        .replace("{jquery.min.js}", jquery.toString())
        .replace("{moment.min.js}", moment.toString())
        .replace("{app.js}", app.toString());
}

function openChatView(id: string) {

    const { type, uin } = parseContactId(id);
    let label: string;
    if (type === "u") {
        label = String(client.fl.get(uin)?.nickname);
    } else {
        label = String(client.gl.get(uin)?.group_name);
    }

    if (webviewMap.has(id)) {
        return webviewMap.get(id)?.reveal();
    }
    const webview = vscode.window.createWebviewPanel("chat", label, -1, {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true
    });
    webviewMap.set(id, webview);
    webview.webview.html = getHtml(webview.webview);
    webview.reveal();
    webview.webview.postMessage(id);
    webview.onDidDispose(() => {
        webviewMap.delete(id);
    });
    webview.webview.onDidReceiveMessage(async (data: WebViewPostData) => {
        if (!data.command) {
            refreshContacts(id, false);
        } else {
            if (data.command === "getChatHistory" && data.params?.[0] === "") {
                let buf: Buffer;
                if (type === "g") {
                    buf = Buffer.alloc(21);
                } else {
                    buf = Buffer.alloc(17);
                }
                buf.writeUInt32BE(uin, 0); 
                data.params[0] = buf.toString("base64");
            }
            const fn = client[data.command];
            if (typeof fn === "function") {
                //@ts-ignore
                let ret: any = fn.apply(client, data.params);
                if (ret instanceof Promise) {
                    ret = await ret;
                }
                if (ret.data instanceof Map) {
                    ret.data = [...ret.data.values()];
                }
                ret.echo = data.echo;
                webview.webview.postMessage(ret);
            }
        }
    });
}

function postC2CEvent(data: oicq.FriendNoticeEventData | oicq.PrivateMessageEventData) {
    const id = genContactId("u", data.user_id);
    webviewMap.get(id)?.webview.postMessage(data);
}

function postGroupEvent(data: oicq.GroupNoticeEventData | oicq.GroupMessageEventData) {
    const id = genContactId("g", data.group_id);
    webviewMap.get(id)?.webview.postMessage(data);
}

export function bind() {
    client.on("message.group", function (data) {
        const id = genContactId("g", data.group_id);
        if (webviewMap.get(id)?.active) {
            return;
        }
        refreshContacts(id, true);
    });

    client.on("message.private", function (data) {
        const id = genContactId("u", data.user_id);
        if (webviewMap.get(id)?.active) {
            return;
        }
        refreshContacts(id, true);
    });

    client.on("message.group", postGroupEvent);
    client.on("message.private", postC2CEvent);

    client.on("notice.group", postGroupEvent);
    client.on("notice.friend.recall", postC2CEvent);
}
