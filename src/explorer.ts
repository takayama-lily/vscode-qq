import * as vscode from 'vscode';
import { readPinned, writePinned } from "./config";
import { client, genContactId, parseContactId } from "./global";
import * as chat from "./chat";

let friendListTreeDataProvider: FriendListTreeDataProvider;
let groupListTreeDataProvider: GroupListTreeDataProvider;
let pinnedTreeDataProvider: PinnedTreeDataProvider;
let itemMap: Map<string, ContactTreeItem> = new Map;

class ContactTreeItem extends vscode.TreeItem {
    new = 0;
    pinned = false;
    id: string;
    constructor(id: string) {
        super(id);
        this.id = id;
    };
    updateLabel(name?: string) {
        this.label = name + (this.new > 0 ? ` (+${this.new})` : "");
        this.tooltip = name + ` (${parseContactId(this.id).uin})`;
    }
}

const EMOJI_PERSON = String.fromCodePoint(0x1f464);
const EMOJI_GROUP = String.fromCodePoint(0x1f465);

/**
 * @abstract
 */
class ContactListTreeDataProvider implements vscode.TreeDataProvider<string> {
    _onDidChangeTreeData = new vscode.EventEmitter<string | undefined | null | void>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    getChildren(): string[] | Promise<string[]> {
        return [];
    }
    getTreeItem(id: string) {
        const { type, uin } = parseContactId(id);
        let item = itemMap.get(id);
        if (!item) {
            item = new ContactTreeItem(id);
            if (type === "u") {
                item.command = {
                    title: "打开私聊", command: "oicq.c2c.open", arguments: [id]
                };
            } else {
                item.command = {
                    title: "打开群聊", command: "oicq.group.open", arguments: [id]
                };
            }
            itemMap.set(id, item);
        }
        if (type === "u") {
            item.updateLabel(EMOJI_PERSON + client.fl.get(uin)?.nickname);
        } else {
            item.updateLabel(EMOJI_GROUP + client.gl.get(uin)?.group_name);
        }
        return item;
    }
    refresh(id?: string) {
        this._onDidChangeTreeData.fire(id);
    }
}

class FriendListTreeDataProvider extends ContactListTreeDataProvider {
    getChildren() {
        const children: string[] = [];
        for (const uin of client?.fl.keys()) {
            const id = genContactId("u", uin);
            if (itemMap.get(id)?.new) {
                children.unshift(id);
            } else {
                children.push(id);
            }
        }
        return children;
    }
}

class GroupListTreeDataProvider extends ContactListTreeDataProvider {
    getChildren() {
        const children: string[] = [];
        for (const uin of client?.gl.keys()) {
            const id = genContactId("g", uin);
            if (itemMap.get(id)?.new) {
                children.unshift(id);
            } else {
                children.push(id);
            }
        }
        return children;
    }
}

class PinnedTreeDataProvider extends ContactListTreeDataProvider {
    inited = false;
    async getChildren() {
        const children: string[] = [];
        if (this.inited) {
            for (const item of itemMap.values()) {
                if (item.pinned) {
                    children.push(item.id);
                }
            }
        } else {
            const pinned = await readPinned();
            for (const item of itemMap.values()) {
                if (pinned.includes(item.id)) {
                    item.pinned = true;
                    children.push(item.id);
                }
            }
            this.inited = true;
        }
        return children;
    }
}

vscode.commands.registerCommand("oicq.contact.pin", (id: string) => {
    const item = itemMap.get(id);
    if (item) {
        item.pinned = true;
    }
    pinnedTreeDataProvider.refresh();
    pinnedTreeDataProvider.getChildren().then(writePinned);
});

vscode.commands.registerCommand("oicq.contact.unpin", (id: string) => {
    const item = itemMap.get(id);
    if (item) {
        item.pinned = false;
    }
    pinnedTreeDataProvider.refresh();
    pinnedTreeDataProvider.getChildren().then(writePinned);
});

vscode.commands.registerCommand("oicq.tooltip.copy", (id: string) => {
    const tooltip = itemMap.get(id)?.tooltip;
    if (tooltip) {
        vscode.env.clipboard.writeText(String(tooltip));
    }
});

vscode.commands.registerCommand("oicq.contact.profile", async (id: string) => {
    const { uin, type } = parseContactId(id);
    const arr: string[] = [];
    if (type === "u") {
        const data = (await client.getStrangerInfo(uin, true)).data;
        if (data) {
            arr.push("账号：" + data.user_id);
            arr.push("昵称：" + data.nickname);
            arr.push("性别：" + data.sex);
            arr.push("年龄：" + data.age);
            arr.push("地区：" + data.area);
        }
    } else {
        const data = (await client.getGroupInfo(uin, true)).data;
        if (data) {
            arr.push("群号：" + data.group_id);
            arr.push("群名：" + data.group_name);
            arr.push(`人数：${data.member_count}/${data.max_member_count}`);
            arr.push("等级：" + data.grade);
            arr.push("活跃人数：" + data.active_member_count);
            arr.push("创建时间：" + new Date(data.create_time * 1000));
            arr.push("最后入群时间：" + new Date(data.last_join_time * 1000));
        }
    }
    vscode.window.showQuickPick(arr);
});

vscode.commands.registerCommand("oicq.friend.delete", (id: string) => {
    vscode.window.showInformationMessage(`确定要删除好友 ${itemMap.get(id)?.tooltip} ？`, "仅删除", "删除并拉黑")
        .then((value) => {
            const { uin } = parseContactId(id);
            if (value === "仅删除") {
                client.deleteFriend(uin, false);
            } else if (value === "删除并拉黑") {
                client.deleteFriend(uin, true);
            }
        });
});

vscode.commands.registerCommand("oicq.group.delete", (id: string) => {
    vscode.window.showInformationMessage(`确定要退出群 ${itemMap.get(id)?.tooltip} ？`, "是")
        .then((value) => {
            const { uin } = parseContactId(id);
            if (value === "是") {
                client.setGroupLeave(uin);
            }
        });
});

export async function initLists() {
    itemMap = new Map;
    friendListTreeDataProvider = new FriendListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-friends", friendListTreeDataProvider);
    groupListTreeDataProvider = new GroupListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-groups", groupListTreeDataProvider);
    pinnedTreeDataProvider = new PinnedTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-pinned", pinnedTreeDataProvider);

    if (!client.listenerCount("notice.friend.increase")) {
        client.on("notice.friend.increase", function (data) {
            vscode.window.showInformationMessage(`新增了好友：${data.nickname} (${data.user_id})`);
            friendListTreeDataProvider.refresh();
            pinnedTreeDataProvider.refresh();
        });

        client.on("notice.friend.decrease", function (data) {
            vscode.window.showInformationMessage(`删除了好友：${data.nickname} (${data.user_id})`);
            friendListTreeDataProvider.refresh();
            pinnedTreeDataProvider.refresh();
        });

        client.on("notice.friend.profile", function (data) {
            const id = genContactId("u", data.user_id);
            friendListTreeDataProvider.refresh(id);
            pinnedTreeDataProvider.refresh(id);
        });

        client.on("notice.group.increase", function (data) {
            if (data.user_id === this.uin) {
                vscode.window.showInformationMessage(`你已加入群：${this.gl.get(data.group_id)?.group_name} (${data.group_id})`);
                groupListTreeDataProvider.refresh();
                pinnedTreeDataProvider.refresh();
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
                pinnedTreeDataProvider.refresh();
            }
        });

        client.on("notice.group.setting", function (data) {
            if (data.group_name) {
                const id = genContactId("g", data.group_id);
                groupListTreeDataProvider.refresh(id);
                pinnedTreeDataProvider.refresh(id);
            }
        });

        client.on("request.friend.add", function (data) {
            vscode.window.showInformationMessage(`${data.nickname}(${data.user_id}) 请求添加你为好友，来自 ${data.source}。附加信息：${data.comment}`, "同意", "拒绝", "拒绝并拉黑")
                .then((value) => {
                    if (value === "同意") {
                        this.setFriendAddRequest(data.flag);
                    } else if (value = "拒绝") {
                        this.setFriendAddRequest(data.flag, false);
                    } else if (value = "拒绝并拉黑") {
                        this.setFriendAddRequest(data.flag, false, "", true);
                    }
                });
        });

        client.on("request.group.invite", function (data) {
            vscode.window.showInformationMessage(`${data.nickname}(${data.user_id}) 邀请你加入群 ${data.group_name}(${data.group_id})。`, "同意", "拒绝", "拒绝并拉黑")
                .then((value) => {
                    if (value === "同意") {
                        this.setGroupAddRequest(data.flag);
                    } else if (value = "拒绝") {
                        this.setGroupAddRequest(data.flag, false);
                    } else if (value = "拒绝并拉黑") {
                        this.setGroupAddRequest(data.flag, false, "", true);
                    }
                });
        });

        client.on("request.group.add", function (data) {
            // @ts-ignore
            if (!this.config.show_me_add_group_request) {
                return;
            }
            vscode.window.showInformationMessage(`${data.nickname}(${data.user_id}) 申请加入群 ${data.group_name}(${data.group_id})。附加信息：${data.comment}`, "同意", "拒绝", "拒绝并拉黑")
                .then((value) => {
                    if (value === "同意") {
                        this.setGroupAddRequest(data.flag);
                    } else if (value = "拒绝") {
                        this.setGroupAddRequest(data.flag, false);
                    } else if (value = "拒绝并拉黑") {
                        this.setGroupAddRequest(data.flag, false, "", true);
                    }
                });
        });

        chat.bind();
    }
}

export function refreshContacts(id: string, flag: boolean) {
    const item = itemMap.get(id);
    if (item) {
        if (flag) {
            ++item.new;
        } else {
            item.new = 0;
        }
    }
    const { type } = parseContactId(id);
    if (type === "u") {
        friendListTreeDataProvider.refresh();
    } else {
        groupListTreeDataProvider.refresh();
    }
    pinnedTreeDataProvider.refresh();
}
