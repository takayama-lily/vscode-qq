import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { refreshContacts } from "./explorer";
import { getConfig } from "./config";
import { client, ctx, genContactId, parseContactId } from "./global";
import { promises } from 'fs';

export interface WebViewPostData {
    command: keyof oicq.Client & 'openImageDialog',
    params: any[],
    echo: string,
}

vscode.commands.registerCommand("oicq.c2c.open", openChatView);
vscode.commands.registerCommand("oicq.group.open", openChatView);

vscode.workspace.onDidChangeConfiguration(evt => {
    if (evt.affectsConfiguration('vscode-qq.theme')) {
        const theme_config = vscode.workspace.getConfiguration("vscode-qq.theme");
        if (theme_config.get<boolean>('autoReload')) {
            reloadChatViews();
        }
    }
    if (evt.affectsConfiguration('vscode-qq.QQ.showAvatarOnTab')) {
        const show_avatar = vscode.workspace.getConfiguration().get<boolean>("vscode-qq.QQ.showAvatarOnTab");
        webviewMap.forEach((webview, id) => {
            if (show_avatar) {
                const { type, uin } = parseContactId(id);
                let icon: string;
                if (type === "u") {
                    icon = "https://q1.qlogo.cn/g?b=qq&s=100&nk=" + uin;
                } else {
                    icon = `https://p.qlogo.cn/gh/${uin}/${uin}/100`;
                }
                webview.iconPath = vscode.Uri.parse(icon);
            } else {
                webview.iconPath = undefined;
            }
        });
    }
});

const webviewMap: Map<string, vscode.WebviewPanel> = new Map;

function getHtml(id: string, webview: vscode.Webview) {
    let preload = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", "preload.js")).toString();
    let css: string, js: string;
    const theme_config = vscode.workspace.getConfiguration("vscode-qq.theme");
    const config_theme = theme_config.get<string>("theme");
    const theme_js = theme_config.get<string>("themeJS");
    const theme_css = theme_config.get<string>("themeCSS");
    if (theme_css && theme_js) {
        if (theme_css.startsWith("http")) {
            css = theme_css;
        } else {
            css = webview.asWebviewUri(vscode.Uri.file(theme_css)).toString();
        }
        if (theme_js.startsWith("http")) {
            js = theme_js;
        } else {
            js = webview.asWebviewUri(vscode.Uri.file(theme_js)).toString();
        }
    } else {
        css = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", config_theme + "-theme", "style.css")).toString();
        js = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets", config_theme + "-theme", "app.js")).toString();
    }
    const { self, type, uin } = parseContactId(id);
    const path = webview.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, "assets")).toString();
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="${css}" />
</head>
<body>
    <env self_id="${self}" nickname="${client.nickname}" c2c="${type === "u" ? 1 : 0}" target_id="${uin}" temp="0" path="${path}">
    <script src="${preload}"></script>
    <script src="${js}"></script>
</body>
</html>`;
}

function reloadChatViews() {
    webviewMap.forEach((webview, id) => {
        webview.webview.html = getHtml(id, webview.webview);
    });
}

function openChatView(id: string) {

    const { type, uin } = parseContactId(id);
    let label: string;
    let icon: string;
    if (type === "u") {
        label = String(client.fl.get(uin)?.nickname);
        icon = "https://q1.qlogo.cn/g?b=qq&s=100&nk=" + uin;
    } else {
        label = String(client.gl.get(uin)?.group_name);
        icon = `https://p.qlogo.cn/gh/${uin}/${uin}/100`;
    }

    if (webviewMap.has(id)) {
        return webviewMap.get(id)?.reveal();
    }
    const webview = vscode.window.createWebviewPanel("chat", label, -1, {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true
    });
    if (vscode.workspace.getConfiguration().get<boolean>('vscode-qq.QQ.showAvatarOnTab')) {
        webview.iconPath = vscode.Uri.parse(icon);
    } else {
        webview.iconPath = undefined;
    }
    webviewMap.set(id, webview);
    webview.webview.html = getHtml(id, webview.webview);
    webview.reveal();
    webview.onDidDispose(() => {
        webviewMap.delete(id);
    });
    webview.onDidChangeViewState((event) => {
        if (event.webviewPanel.visible) {
            refreshContacts(id, false);
        }
    });
    webview.webview.onDidReceiveMessage(async (data: WebViewPostData) => {
        try {
            if (data.command === "openImageDialog") {
                vscode.window.showOpenDialog({
                    title: "请选择要插入的图片",
                    canSelectMany: true,
                    openLabel: "插入",
                    filters: {
                        "图片图像": ["png", "jpg", "jpeg", "gif"],
                    }
                }).then(async value => {
                    if (value) {
                        const files = await Promise.all(
                            value.map(async v => {
                                return webview.webview.asWebviewUri(vscode.Uri.parse(v.fsPath));
                            })
                        );
                        webview.webview.postMessage({
                            post_type: "system",
                            sub_type: "insert-image",
                            files
                        });
                    }
                });
                return;
            }
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
                let ret: any = fn.apply(client, Array.isArray(data.params) ? data.params : []);
                if (ret instanceof Promise) {
                    ret = await ret;
                }
                if (ret.data instanceof Map) {
                    ret.data = [...ret.data.values()];
                }
                ret.echo = data.echo;
                webview.webview.postMessage(ret);
            }
        } catch { }
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
        if (webviewMap.get(id)?.visible) {
            return;
        }
        refreshContacts(id, true);
    });

    client.on("message.private", function (data) {
        const id = genContactId("u", data.user_id);
        if (webviewMap.get(id)?.visible) {
            return;
        }
        refreshContacts(id, true);
    });

    client.on("message.group", postGroupEvent);
    client.on("message.private", postC2CEvent);

    client.on("notice.group", postGroupEvent);
    client.on("notice.friend.recall", postC2CEvent);
    client.on("notice.friend.poke", postC2CEvent);
}
