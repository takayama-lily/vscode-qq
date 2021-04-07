import * as oicq from "oicq";
type MessageEventData = oicq.PrivateMessageEventData | oicq.GroupMessageEventData;
type NoticeEventData = oicq.FriendNoticeEventData | oicq.GroupNoticeEventData;

export interface Webview extends EventTarget {
    readonly self_id: number;
    readonly nickname: string;
    readonly c2c: boolean;
    readonly target_id: number;
    readonly assets_path: string;
    readonly faces_path: string;
    readonly TimeoutError: typeof Error
    on(type: "message", listener: (data: CustomEvent<MessageEventData>) => void): void;
    on(type: "notice", listener: (data: CustomEvent<NoticeEventData>) => void): void;

    callApi(command: keyof oicq.Client, params?: any[]): Promise<oicq.Ret<unknown>>;

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
    
    getGroupInfo: oicq.Client["getGroupInfo"];
    getGroupMemberList(uin: number): Promise<oicq.Ret<oicq.MemberInfo[]>>;
    getGroupMemberInfo: oicq.Client["getGroupMemberInfo"];
    getForwardMsg: oicq.Client["getForwardMsg"];

    scrollHome(): void;
    scrollEnd(): void;
    timestamp(unixtime: number): string;
    datetime(unixtime: number): string;
    getUserAvaterUrlSmall(uin: number): string;
    getUserAvaterUrlLarge(uin: number): string;
    getGroupAvaterUrl(uin: number): string;
}
