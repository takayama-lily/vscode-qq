import * as oicq from "oicq";
type MessageEventData = oicq.PrivateMessageEventData | oicq.GroupMessageEventData;
type NoticeEventData = oicq.FriendNoticeEventData | oicq.GroupNoticeEventData;

/**
 * webview类型参考
 */
export interface Webview extends EventTarget {
    readonly self_uin: number; //自己账号
    readonly nickname: string; //自己昵称
    readonly c2c: boolean; //私聊为true，群聊为false
    readonly target_uin: number; //私聊时为对方账号，群聊时为群号
    readonly assets_path: string; //assets文件夹路径("/"结尾)
    readonly faces_path: string; //表情文件夹路径("/"结尾)
    readonly t: number; //vsc启动时间戳，用于解决头像缓存问题
    readonly TimeoutError: typeof Error;
    readonly send_key: number; //发送消息的快捷键

    // 监听新消息事件
    on(type: "message", listener: (data: CustomEvent<MessageEventData>) => void): void;
    // 监听新系统通知事件
    on(type: "notice", listener: (data: CustomEvent<NoticeEventData>) => void): void;

    callApi(command: keyof oicq.Client, params?: any[]): Promise<oicq.Ret<unknown>>;

    sendMsg(message: string | oicq.MessageElem | Iterable<oicq.MessageElem>, auto_escape?: boolean): Promise<oicq.Ret<{ message_id: string }>>;
    sendPrivateMsg: oicq.Client["sendPrivateMsg"];
    sendGroupMsg: oicq.Client["sendGroupMsg"];
    deleteMsg: oicq.Client["deleteMsg"];
    getChatHistory: oicq.Client["getChatHistory"];
    sendGroupPoke: oicq.Client["sendGroupPoke"];
    setGroupCard: oicq.Client["setGroupCard"];
    setGroupAdmin: oicq.Client["setGroupAdmin"];
    setGroupSpecialTitle: oicq.Client["setGroupSpecialTitle"];
    setGroupKick: oicq.Client["setGroupKick"];
    setGroupBan: oicq.Client["setGroupBan"];
    setGroupWholeBan: oicq.Client["setGroupWholeBan"];
    setGroupAnonymousBan: oicq.Client["setGroupAnonymousBan"];
    
    getStrangerInfo: oicq.Client["getStrangerInfo"];
    getGroupInfo: oicq.Client["getGroupInfo"];
    getGroupMemberList(uin: number): Promise<oicq.Ret<oicq.MemberInfo[]>>;
    getGroupMemberInfo: oicq.Client["getGroupMemberInfo"];
    getForwardMsg: oicq.Client["getForwardMsg"];
    getGroupNotice: oicq.Client["getGroupNotice"];
    getRoamingStamp: oicq.Client["getRoamingStamp"];
    getMsg: oicq.Client["getMsg"];

    scrollHome(): void;
    scrollEnd(): void;
    timestamp(unixtime?: number): string;
    datetime(unixtime?: number): string;
    getUserAvaterUrlSmall(uin: number): string;
    getUserAvaterUrlLarge(uin: number): string;
    getGroupAvaterUrlSmall(uin: number): string;
    getGroupAvaterUrlLarge(uin: number): string;
}
