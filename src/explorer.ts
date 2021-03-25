import * as vscode from 'vscode';
import { client, genContactId, parseContactId } from "./global";
import * as chat from "./chat";

let friendListTreeDataProvider: FriendListTreeDataProvider;
let groupListTreeDataProvider: GroupListTreeDataProvider;
let itemMap: Map<string, ContactTreeItem> = new Map;

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
        return [...client?.fl.keys()].sort((a, b) => {
            const ida = genContactId("u", a);
            const idb = genContactId("u", b);
            if (itemMap.get(ida)?.new) {
                return -1;
            }
            if (itemMap.get(idb)?.new) {
                return 1;
            }
            return 0;
        });
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
        return [...client?.gl.keys()].sort((a, b) => {
            const ida = genContactId("g", a);
            const idb = genContactId("g", b);
            if (itemMap.get(ida)?.new) {
                return -1;
            }
            if (itemMap.get(idb)?.new) {
                return 1;
            }
            return 0;
        });
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
            if (!this.config.show_me_add_group_request) {
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

        chat.bind();
    }
}

export function refreshContacts(id: string, flag: boolean) {
    if (itemMap.has(id)) {
        //@ts-ignore
        itemMap.get(id)?.new = flag;
    }
    const { type } = parseContactId(id);
    if (type === "u") {
        friendListTreeDataProvider.refresh();
    } else {
        groupListTreeDataProvider.refresh();
    }
}
