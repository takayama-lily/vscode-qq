import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { client } from "./global";

// export function bind(c: oicq.Client) {
//     client = c;
// }

// class FriendTreeItem extends vscode.TreeItem {
//     detail?: oicq.FriendInfo;
// }

export class FriendListTreeDataProvider implements vscode.TreeDataProvider<number> {
    getChildren() {
        return [...client?.fl.keys()];
    }
    getTreeItem(uin: number) {
        const item = new vscode.TreeItem(client?.fl.get(uin)?.nickname ?? "removed");
        item.id = String(uin);
        return item;
    }
}

// class GroupTreeItem extends vscode.TreeItem {
//     detail?: oicq.GroupInfo;
// }

export class GroupListTreeDataProvider implements vscode.TreeDataProvider<number> {
    getChildren() {
        return [...client?.gl.keys()];
    }
    getTreeItem(uin: number) {
        const item = new vscode.TreeItem(client?.gl.get(uin)?.group_name ?? "removed");
        item.id = String(uin);
        return item;
    }
}
