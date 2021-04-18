import * as vscode from 'vscode';
import { readPinned, writePinned } from "./config";
import { client, genContactId, parseContactId } from "./global";
import * as chat from "./chat";

// 声明

let friendListTreeDataProvider: FriendListTreeDataProvider;
let groupListTreeDataProvider: GroupListTreeDataProvider;
let pinnedTreeDataProvider: PinnedTreeDataProvider;
let itemMap: Map<string, ContactTreeItem> = new Map;
let firendTreeView: vscode.TreeView<string>;
let groupTreeView: vscode.TreeView<string>;

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

abstract class ContactListTreeDataProvider implements vscode.TreeDataProvider<string> {
    _onDidChangeTreeData = new vscode.EventEmitter<string | undefined | null | void>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    abstract getChildren(): string[] | Promise<string[]>;
    getParent(id: string) {
        return null;
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
            const emoji = client.fl.get(uin)?.sex === "female" ? "🙎‍♀️" : "🙎‍♂️";
            item.updateLabel(emoji + client.fl.get(uin)?.nickname);
        } else {
            item.updateLabel("👨‍👦‍👦" + client.gl.get(uin)?.group_name);
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

// 注册指令

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
        }
    }
    vscode.window.showQuickPick(arr);
});

vscode.commands.registerCommand("oicq.friend.search", () => {
    if (!firendTreeView) {
        return vscode.window.showErrorMessage("请先登录");
    }
    const arr = [];
    for (let [k, v] of client.fl) {
        arr.push(v.nickname + " (" + v.user_id + ")");
    }
    vscode.window.showQuickPick(arr).then((value) => {
        if (value) {
            const uin = value.slice(value.lastIndexOf("(") + 1, -1);
            firendTreeView.reveal(genContactId("u", Number(uin)), { focus: true, select: true });
        }
    });
});
vscode.commands.registerCommand("oicq.group.search", () => {
    if (!groupTreeView) {
        return vscode.window.showErrorMessage("请先登录");
    }
    const arr = [];
    for (let [k, v] of client.gl) {
        arr.push(v.group_name + " (" + v.group_id + ")");
    }
    vscode.window.showQuickPick(arr).then((value) => {
        if (value) {
            const uin = value.slice(value.lastIndexOf("(") + 1, -1);
            groupTreeView.reveal(genContactId("g", Number(uin)), { focus: true, select: true });
        }
    });
});

vscode.commands.registerCommand("oicq.group.invite", (id: string) => {
    const { uin, type } = parseContactId(id);
    let placeHolder: string, gid: number, uid: number;
    const arr = [];
    if (type === "u") {
        uid = uin;
        for (let [k, v] of client.gl) {
            arr.push("👨‍👦‍👦" + v.group_name + " (" + v.group_id + ")");
        }
        placeHolder = "选择一个群，邀请好友 " + itemMap.get(id)?.tooltip + " 加入";
    } else {
        gid = uin;
        for (let [k, v] of client.fl) {
            arr.push(v.nickname + " (" + v.user_id + ")");
        }
        placeHolder = "选择好友，邀请TA加入群 " + itemMap.get(id)?.tooltip;
    }
    vscode.window.showQuickPick(arr, { placeHolder }).then((value) => {
        if (value) {
            const uin = value.slice(value.lastIndexOf("(") + 1, -1);
            if (!gid) {
                gid = Number(uin);
            }
            if (!uid) {
                uid = Number(uin);
            }
            client.inviteFriend(gid, uid).then((data) => {
                if (data.retcode === 0) {
                    vscode.window.showInformationMessage("邀请发送成功。");
                } else {
                    vscode.window.showErrorMessage("邀请失败，请确认你是否有邀请的权限，或对方已经入群。");
                }
            });
        }
    });
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
                client.setGroupLeave(uin).then(() => {
                    setTimeout(() => {
                        groupListTreeDataProvider.refresh();
                        pinnedTreeDataProvider.refresh();
                    }, 500);
                });
            }
        });
});

vscode.commands.registerCommand("oicq.pinned.refresh", () => {
    pinnedTreeDataProvider?.refresh();
});
vscode.commands.registerCommand("oicq.friends.refresh", () => {
    friendListTreeDataProvider?.refresh();
});
vscode.commands.registerCommand("oicq.groups.refresh", () => {
    groupListTreeDataProvider?.refresh();
});

/**
 * system.online
 */
export async function initLists() {
    itemMap = new Map;
    friendListTreeDataProvider = new FriendListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-friends", friendListTreeDataProvider);
    groupListTreeDataProvider = new GroupListTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-groups", groupListTreeDataProvider);
    pinnedTreeDataProvider = new PinnedTreeDataProvider;
    vscode.window.registerTreeDataProvider("chat-pinned", pinnedTreeDataProvider);
    firendTreeView = vscode.window.createTreeView("chat-friends", {
        treeDataProvider: friendListTreeDataProvider
    });
    firendTreeView.reveal("");
    groupTreeView = vscode.window.createTreeView("chat-groups", {
        treeDataProvider: groupListTreeDataProvider
    });
    groupTreeView.reveal("");

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
                const label = itemMap.get(genContactId("g", data.group_id))?.tooltip;
                if (data.dismiss) {
                    msg = label + ` 已解散`;
                } else if (data.operator_id === this.uin) {
                    msg = `你退出了群 ` + label;
                } else {
                    msg = `${data.operator_id} 将你踢出了群 ` + label;
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

        client.on("notice.group.transfer", function (data) {
            if (data.user_id === this.uin) {
                const label = itemMap.get(genContactId("g", data.group_id))?.tooltip;
                const msg = `${label} 群主已将群主身份转让给你`;
                vscode.window.showInformationMessage(msg);
            }
        });

        client.on("notice.group.admin", function (data) {
            if (data.user_id === this.uin) {
                const label = itemMap.get(genContactId("g", data.group_id))?.tooltip;
                const msg = data.set ? `你已成为群 ${label} 的管理员` : `你被取消了群 ${label} 的管理员`;
                vscode.window.showInformationMessage(msg);
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

/**
 * 刷新treeItems
 * @param flag true:有新消息 false:解除新消息
 */
export function refreshContacts(id: string, flag: boolean) {
    const item = itemMap.get(id);
    const { type } = parseContactId(id);
    const provider = type === "u" ? friendListTreeDataProvider : groupListTreeDataProvider;
    if (!item) {
        provider.refresh();
        pinnedTreeDataProvider.refresh();
        return;
    }
    if (flag) {
        ++item.new;
        if (item.new > 1) {
            provider.refresh(id);
            pinnedTreeDataProvider.refresh(id);
        } else {
            provider.refresh();
            pinnedTreeDataProvider.refresh(id);
        }
    } else {
        if (!item.new) {
            return;
        } else {
            item.new = 0;
            provider.refresh(id);
            pinnedTreeDataProvider.refresh(id);
        }
    }
}

/**
 * 列表刷新规则：
 * 
 *  好友增加减少时：全部刷新
 *  群增加减少时：全部刷新
 *  好友修改昵称时：单个刷新
 *  群名变更时：单个刷新
 * 
 *  收到新消息时：
 *      列表中不存在时：全部刷新
 *      之前无新消息时：全部刷新(新消息+1)
 *      之前有新消息时：单个刷新(新消息+1)
 *      视图已打开并可见时：不刷新
 *      视图已打开不可见时：
 *          之前无新消息时：全部刷新(新消息+1)
 *          之前有新消息时：单个刷新(新消息+1)
 * 
 *  打开视图时/视图聚焦时(需要通过webview上报window.focus事件)：
 *      之前无新消息时：不刷新
 *      之前有新消息时：单个刷新(新消息置0)
 * 
 * (全部刷新的目的在于排序)
 */
