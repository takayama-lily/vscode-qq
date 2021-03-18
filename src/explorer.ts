import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { client } from "./global";

let friendListTreeDataProvider: FriendListTreeDataProvider;
let groupListTreeDataProvider: ContactListTreeDataProvider;
let strangerListTreeDataProvider: StrangerListTreeDataProvider;

vscode.commands.registerCommand("oicq.friend.open", async (uin: number) => {
    const uri = friendListTreeDataProvider.getTreeItem(uin).resourceUri;
    if (uri) {
        const doc = await vscode.workspace.openTextDocument(uri);
        vscode.window.showTextDocument(doc, { preview: false });
    }
});
vscode.commands.registerCommand("oicq.group.open", async (uin) => {
    const uri = groupListTreeDataProvider.getTreeItem(uin).resourceUri;
    if (uri) {
        const doc = await vscode.workspace.openTextDocument(uri);
        vscode.window.showTextDocument(doc, { preview: false });
    }
});

class ContactTreeItem extends vscode.TreeItem {
    uin: number;
    constructor(uin: number) {
        super(String(uin));
        this.uin = uin;
    };
    updateLabel(name?: string) {
        this.label = name;
        this.tooltip = name + ` (${this.uin})`;
        this.resourceUri = vscode.Uri.parse(`oicq: ${name}(${this.uin})`);
    }
}

class ContactListTreeDataProvider implements vscode.TreeDataProvider<number> {
    _onDidChangeTreeData = new vscode.EventEmitter<number | undefined | null | void>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    getChildren() {
        return [0];
    }
    getTreeItem(uin: number) {
        return new vscode.TreeItem("dummy");;
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
        const item = new ContactTreeItem(uin);
        item.updateLabel(obj?.nickname);
        item.command = {
            title: "oicq.friend.open", command: "oicq.friend.open", arguments: [uin]
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
        const item = new ContactTreeItem(uin);
        item.updateLabel(obj?.group_name);
        item.command = {
            title: "oicq.group.open", command: "oicq.group.open", arguments: [uin]
        };
        return item;
    }
}

class StrangerListTreeDataProvider extends ContactListTreeDataProvider {
    getChildren() {
        return [...client?.sl.keys()];
    }
    getTreeItem(uin: number) {
        const obj = client.sl.get(uin);
        const item = new ContactTreeItem(uin);
        item.updateLabel(obj?.nickname);
        item.command = {
            title: "oicq.stranger.open", command: "oicq.stranger.open", arguments: [uin]
        };
        return item;
    }
}

export function initLists() {
    friendListTreeDataProvider = new FriendListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-friends", friendListTreeDataProvider);
    groupListTreeDataProvider = new GroupListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-groups", groupListTreeDataProvider);
    strangerListTreeDataProvider = new StrangerListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-strangers", strangerListTreeDataProvider);

    client.on("notice.friend.increase", function (data) {
        vscode.window.showInformationMessage(`新增了好友：${data.nickname} (${data.user_id})`)
        friendListTreeDataProvider.refresh();
    });

    client.on("notice.friend.decrease", function (data) {
        vscode.window.showInformationMessage(`删除了好友：${data.nickname} (${data.user_id})`)
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
        if (data.group_name)
            groupListTreeDataProvider.refresh(data.group_id);
    });
}
