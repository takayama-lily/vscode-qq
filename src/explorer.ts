import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { client, ctx, genContactId, parseContactId } from "./global";

let friendListTreeDataProvider: FriendListTreeDataProvider;
let groupListTreeDataProvider: GroupListTreeDataProvider;
let itemMap: Map<string, ContactTreeItem> = new Map;

vscode.commands.registerCommand("oicq.user.open", (uin: number) => {
    const id = genContactId("u", uin);
    const item = itemMap.get(id);
    if (item) {
        openChatView(id, item.tooltip);
    }
});
vscode.commands.registerCommand("oicq.group.open", (uin: number) => {
    const id = genContactId("g", uin);
    const item = itemMap.get(id);
    if (item) {
        openChatView(id, item.tooltip);
    }
});

class ContactTreeItem extends vscode.TreeItem {
    new = false;
    id: string;
    constructor(id: string) {
        super(id);
        this.id = id;
    };
    updateLabel(name?: string) {
        this.label = name + (this.new ? " (有新消息)" : "");
        this.tooltip = name + ` (${parseContactId(this.id).uin})`;
    }
}

/**
 * @abstract
 */
class ContactListTreeDataProvider implements vscode.TreeDataProvider<number> {
    _onDidChangeTreeData = new vscode.EventEmitter<number | undefined | null | void>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    getChildren() {
        return [0];
    }
    getTreeItem(uin: number) {
        return new vscode.TreeItem("dummy");;
    }
    createItemIfNotExists(id: string) {
        let item = itemMap.get(id);
        if (item === undefined) {
            item = new ContactTreeItem(id);
            itemMap.set(id, item);
        }
        return item;
    }
    refresh(uin?: number) {
        this._onDidChangeTreeData.fire(uin);
    }
}

class FriendListTreeDataProvider extends ContactListTreeDataProvider {
    getChildren() {
        return [...client?.fl.keys()];
    }
    getTreeItem(uin: number) {
        const obj = client.fl.get(uin);
        const item = this.createItemIfNotExists(genContactId("u", uin));
        item.updateLabel(obj?.nickname);
        item.command = {
            title: "oicq.user.open", command: "oicq.user.open", arguments: [uin]
        };
        return item;
    }
}

class GroupListTreeDataProvider extends ContactListTreeDataProvider {
    getChildren() {
        return [...client?.gl.keys()];
    }
    getTreeItem(uin: number) {
        const obj = client.gl.get(uin);
        const item = this.createItemIfNotExists(genContactId("g", uin));
        item.updateLabel(obj?.group_name);
        item.command = {
            title: "oicq.group.open", command: "oicq.group.open", arguments: [uin]
        };
        return item;
    }
}

export function initLists() {
    itemMap = new Map;
    friendListTreeDataProvider = new FriendListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-friends", friendListTreeDataProvider);
    groupListTreeDataProvider = new GroupListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-groups", groupListTreeDataProvider);

    if (!client.listenerCount("notice.friend.increase")) {
        client.on("notice.friend.increase", function (data) {
            vscode.window.showInformationMessage(`新增了好友：${data.nickname} (${data.user_id})`);
            friendListTreeDataProvider.refresh();
        });
    
        client.on("notice.friend.decrease", function (data) {
            vscode.window.showInformationMessage(`删除了好友：${data.nickname} (${data.user_id})`);
            friendListTreeDataProvider.refresh();
        });
    
        client.on("notice.friend.profile", function (data) {
            friendListTreeDataProvider.refresh(data.user_id);
        });
    
        client.on("notice.group.increase", function (data) {
            if (data.user_id === this.uin) {
                vscode.window.showInformationMessage(`你已加入群：${this.gl.get(data.group_id)?.group_name} (${data.group_id})`);
                groupListTreeDataProvider.refresh();
            }
        });
        client.on("notice.group.decrease", function (data) {
            if (data.user_id === this.uin) {
                let msg: string;
                if (data.operator_id === this.uin) {
                    msg = `你退出了群：${data.group_id}`;
                } else {
                    msg = `${data.operator_id} 将你踢出了群：${data.group_id}`;
                }
                vscode.window.showInformationMessage(msg);
                groupListTreeDataProvider.refresh();
            }
        });
    
        client.on("notice.group.setting", function (data) {
            if (data.group_name) {
                groupListTreeDataProvider.refresh(data.group_id);
            }
        });
    
        client.on("request.friend.add", function (data) {
            vscode.window.showInformationMessage(`${data.nickname}(${data.user_id}) 请求添加你为好友，来自 ${data.source}。附加信息：${data.comment}`, "同意", "拒绝")
                .then((value) => {
                    if (value === "同意") {
                        this.setFriendAddRequest(data.flag);
                    } else if (value = "拒绝") {
                        this.setFriendAddRequest(data.flag, false);
                    }
                });
        });
    
        client.on("request.group.invite", function (data) {
            vscode.window.showInformationMessage(`${data.nickname}(${data.user_id}) 邀请你加入群 ${data.group_name}(${data.group_id})。`, "同意", "拒绝")
                .then((value) => {
                    if (value === "同意") {
                        this.setGroupAddRequest(data.flag);
                    } else if (value = "拒绝") {
                        this.setGroupAddRequest(data.flag, false);
                    }
                });
        });
    
        client.on("request.group.add", function (data) {
            // @ts-ignore
            if (!this.config.show_me_add_group_request2) {
                return;
            }
            vscode.window.showInformationMessage(`${data.nickname}(${data.user_id}) 申请加入群 ${data.group_name}(${data.group_id})。附加信息：${data.comment}`, "同意", "拒绝")
                .then((value) => {
                    if (value === "同意") {
                        this.setGroupAddRequest(data.flag);
                    } else if (value = "拒绝") {
                        this.setGroupAddRequest(data.flag, false);
                    }
                });
        });

        client.on("message.group", function (data) {
            const id = this.uin + "g" + data.group_id;
            if (webviewMap.get(id)?.active) {
                return;
            }
            groupListTreeDataProvider.getTreeItem(data.group_id).new = true;
            groupListTreeDataProvider.refresh(data.group_id);
        });

        client.on("message.private", function (data) {
            const id = this.uin + "u" + data.user_id;
            if (webviewMap.get(id)?.active) {
                return;
            }
            if (this.fl.has(data.user_id)) {
                friendListTreeDataProvider.getTreeItem(data.user_id).new = true;
                friendListTreeDataProvider.refresh(data.user_id);
            }
        });

        client.on("message.group", onGroupMessage);
        client.on("message.private", onC2CMessage);
    }
}

export const webviewMap: Map<string, vscode.WebviewPanel> = new Map;
const lastMsgMap: Map<string, oicq.PrivateMessageEventData | oicq.GroupMessageEventData> = new Map;
let html = "";

export function openChatView(id: string, label?: string | vscode.MarkdownString) {
    if (webviewMap.has(id)) {
        return webviewMap.get(id)?.reveal();
    }
    if (!html) {
        html = fs.readFileSync(path.join(ctx.extensionPath, "chat.html"), { encoding: "utf-8" });
    }
    const webview = vscode.window.createWebviewPanel("chat", String(label), -1, {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true
    });
    webviewMap.set(id, webview);
    webview.webview.html = html;
    webview.reveal();
    if (lastMsgMap.has(id)) {
        webview.webview.postMessage(lastMsgMap.get(id));
    }
    lastMsgMap.delete(id);
    webview.onDidDispose(() => {
        webviewMap.delete(id);
    });
    webview.webview.onDidReceiveMessage((data) => {
        const item = itemMap.get(id);
        if (!item) {
            return;
        }
        item.new = false;
        const { type, uin } = parseContactId(id);
        if (data?.command === "focused") {
            if (type === "u") {
                friendListTreeDataProvider.refresh(uin);
            } else {
                groupListTreeDataProvider.refresh(uin);
            }
        } else if (data?.command === "send") {
            if (type === "u") {
                client.sendPrivateMsg(uin, data?.data);
            } else {
                client.sendGroupMsg(uin, data?.data);
            }
        }
    });
}

function onMessage(id: string, data: oicq.PrivateMessageEventData | oicq.GroupMessageEventData) {
    const webview = webviewMap.get(id);
    if (webview) {
        webview.webview.postMessage(data);
    } else {
        lastMsgMap.set(id, data);
    }
}

export function onC2CMessage(this: oicq.Client, data: oicq.PrivateMessageEventData) {
    const id = genContactId("u", data.user_id);
    onMessage(id, data);
}

export function onGroupMessage(this: oicq.Client, data: oicq.GroupMessageEventData) {
    const id = genContactId("g", data.group_id);
    onMessage(id, data);
}
