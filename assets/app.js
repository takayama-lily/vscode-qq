/**
 * @type {import("vscode").Webview}
 */
const vscode = acquireVsCodeApi();

let me = 0;
let c2c = false;
let id = "";
let uin = 0;

// 上报window focus事件
window.onfocus = () => {
    vscode.postMessage("focused");
};

/**
 * 群员列表
 * @type {Map<number, import("oicq").MemberInfo>}
 */
let members = new Map;

// 监听来自vscode的消息
window.addEventListener("message", async function (event) {

    // init
    if (typeof event.data === "string") {
        id = event.data;
        me = parseInt(id);
        c2c = id.includes("u") ? true : false;
        uin = parseInt(id.replace(/^[0-9]+[a-z]{1}/, ""));
        if (!c2c) {
            await updateMemberList();
        }
        getChatHistory();
        return;
    }

    if (!event.data.echo) {
        // event
        if (event.data.post_type === "message") {
            $("#lite-chatbox").append(genUserMessage(event.data));
        } else if (event.data.post_type === "notice") {
            $("#lite-chatbox").append(genSystemMessage(event.data));
        }
    } else {
        // api ret
        handlers.get(event.data?.echo)?.call(null, event.data);
        handlers.delete(event.data.echo);
    }
});

/**
 * @type {Map<string, Function>}
 */
const handlers = new Map;
class TimeoutError extends Error { }

/**
 * @param {string} command 
 * @param {any[]} params
 */
function callApi(command, params) {
    const echo = String(Date.now()) + String(Math.random());
    const obj = {
        command, params, echo
    };
    return new Promise((resolve, reject) => {
        vscode.postMessage(obj);
        const id = setTimeout(() => {
            reject(new TimeoutError);
            handlers.delete(echo);
        }, 5000);
        handlers.set(echo, (data) => {
            clearTimeout(id);
            resolve(data);
        });
    });
    
}

async function updateMemberList() {
    const arr = (await callApi("getGroupMemberList", [uin])).data;
    members = new Map;
    for (let v of arr) {
        members.set(v.user_id, v);
    }
}

function getChatHistory(message_id = "", count = 5) {
    callApi("getChatHistory", [message_id, count]).then((data) => {
        let html = "";
        for (let msg of data.data) {
            if (msg.message_id !== message_id) {
                html += genUserMessage(msg);
            }
        }
        $("#lite-chatbox").prepend(html);
    });
}

function sendMsg() {
    const message = $("#content").val();
    if (!message) {
        return;
    }
    callApi(c2c ? "sendPrivateMsg" : "sendGroupMsg", [uin, message]).then((data) => {
        if (c2c && data.data.message_id) {
            const html = `<a class="msgid" id="${data.data.message_id}"></a><div class="cright cmsg">
    <img class="headIcon radius" ondragstart="return false;" oncontextmenu="return false;" src="${genAvaterUrl(me)}" />
    <span msgid="${data.data.message_id}" class="name" title="我(${me}) ${moment().format('YYYY/MM/DD k:mm:ss')}">我 ${moment().format('k:mm:ss')}</span>
    <span class="content">${filterXss(message)}</span>
</div>`;
            $("#lite-chatbox").append(html);
        }
    });
    $("#content").val("");
}

/**
 * 生成系统消息
 * @param {import("oicq").GroupNoticeEventData | import("oicq").FriendNoticeEventData} data 
 */
function genSystemMessage(data) {
    let msg = "";
    if (data.notice_type === "friend") {
        switch (data.sub_type) {
            case "recall":
                msg = `有人想撤回 <a href="#${data.message_id}">一条消息</>`;
                appendRecalledText(data.message_id);
                break;
        }
    } else if (data.notice_type === "group") {
        updateMemberList();
        switch (data.sub_type) {
            case "recall":
                msg = `${genLabel(data.operator_id)} 撤回了 ${data.user_id === data.operator_id ? "自己" : genLabel(data.user_id)} 的 <a href="#${data.message_id}">一条消息</>`;
                appendRecalledText(data.message_id);
                break;
            case "increase":
                msg = `${filterXss(data.nickname)}(${data.user_id}) 加入了群聊`;
                break;
            case "decrease":
                if (data.dismiss) {
                    msg = `该群已被解散`;
                    break;
                }
                if (data.operator_id === data.user_id) {
                    msg = `${genLabel(data.user_id)} 退出了群聊`;
                } else {
                    msg = `${genLabel(data.operator_id)} 踢出了 ${genLabel(data.user_id)}`;
                }
                break;
            case "admin":
                msg = `${genLabel(data.user_id)} ${data.set ? "成为了" : "被取消了"}管理员`;
                break;
            case "transfer":
                msg = `${genLabel(data.operator_id)} 将群主转让给了 ${genLabel(data.user_id)}`;
                break;
            case "ban":
                msg = `${genLabel(data.operator_id)} 禁言 ${data.user_id === 80000000 ? "匿名用户("+data.nickname+")" : genLabel(data.user_id)} ${data.duration}秒`;
                break;
            case "poke":
                msg = `${genLabel(data.operator_id)} ${data.action} ${genLabel(data.user_id)} ${data.suffix}`;
                break;
        }
    }
    if (!msg) {
        return "";
    }
    return `<div class="tips">
    <span class="tips-info">${msg}</span>
</div>`;
}

/**
 * 生成标签
 * @param {number} user_id 
 */
function genLabel(user_id) {
    const member = members?.get(user_id);
    if (!member) {
        return user_id;
    }
    return `${filterXss(member.card ? member.card : member.nickname)}(${user_id})`;
}

/**
 * 转义message_id中的特殊字符
 * @param {string} message_id 
 */
function filterMsgIdSelector(message_id) {
    return message_id.replace(/\//g, "\\/").replace(/\=/g, "\\=");
}

/**
 * @param {string} message_id 
 */
function appendRecalledText(message_id) {
    let html = $("span[msgid="+filterMsgIdSelector(message_id)+"]").html();
    if (html) {
        $("span[msgid="+filterMsgIdSelector(message_id)+"]").html(html + " (已撤回)");
    }
}

/**
 * 生成一般消息
 * @param {import("oicq").PrivateMessageEventData | import("oicq").GroupMessageEventData} data 
 */
function genUserMessage(data) {
    if ($("#" + filterMsgIdSelector(data.message_id)).length > 0) {
        return "";
    }
    let title = "";
    
    if (data.anonymous) {
        data.sender.card = data.anonymous.name;
        title = `<span class="htitle member">匿名</span>`;
    } else {
        const role = members.get(data.user_id)?.role;
        if (role === "admin" || role === "owner") {
            title = `<span class="htitle ${role}">${role}</span>`;
        }
    }
    return `<a class="msgid" id="${data.message_id}"></a><div class="${data.user_id === data.self_id ? "cright" : "cleft"} cmsg">
    <img class="headIcon radius" ondragstart="return false;" oncontextmenu="return false;" src="${genAvaterUrl(data.user_id)}" />
    <span msgid="${data.message_id}" class="name" title="${filterXss(data.sender.nickname)}(${data.user_id}) ${moment(data.time * 1000).format('YYYY/MM/DD k:mm:ss')}">${title}${filterXss(data.sender.card ? data.sender.card : data.sender.nickname)} ${moment(data.time * 1000).format('k:mm:ss')}</span>
    <span class="content">${parseMessage(data.message)}</span>
</div>`;
}

const xssMap = {
    "&": "&amp;",
    "\"": "&quot;",
    "<": "&lt;",
    ">": "&gt;",
    " ": "&nbsp;",
    "\t": "&emsp;",
};

/**
 * xss过滤
 * @param {string} str 
 */
function filterXss(str) {
    str = str.replace(/[&"<>\t ]/g, (s) => {
        return xssMap[s];
    });
    str = str.replace(/\r\n/g, "<br>").replace(/\r/g, "<br>").replace(/\n/g, "<br>");
    return str;
}

/**
 * 生成用户头像url
 * @param {number} user_id 
 */
function genAvaterUrl(user_id) {
    return `http://q1.qlogo.cn/g?b=qq&s=100&nk=` + user_id;
}

/**
 * 生成消息字符串
 * @param {import("oicq").MessageElem[]} message 
 */
function parseMessage(message) {
    let msg = "";
    for (let v of message) {
        switch (v.type) {
            case "text":
            case "at":
                msg += filterXss(v.data.text);
                break;
            case "face":
            case "sface":
            case "bface":
                if (v.data.text) {
                    msg += filterXss(v.data.text);
                } else {
                    msg += "[表情]";
                }
                break;
            case "image":
                msg += `<a href="${v.data.url}" target="_blank" class="chat-img">[图片]</a>`;
                break;
            case "flash":
                // let width = v.data.file.split("-")[1];
                // width = parseInt(10000 / (width / 2));
                // if (width > 100) {
                //     width = 100;
                // }
                // msg += `<div style="width: ${width}%"><a href="${v.data.url}" target="_blank"><img src="${v.data.url}"></a></div>`;
                msg += `<a href="${v.data.url}" target="_blank">[闪照]</a>`;
                break;
            case "record":
                msg += "[语音]";
                break;
            case "video":
                msg += "[视频]";
                break;
            case "xml":
                msg += "[xml消息]";
                break;
            case "json":
                msg += "[json消息]";
                break;
            case "file":
                msg += "[文件]";
                break;
            case "reply":
                msg += `<a href="#${v.data.id}">[回复]</a>`;
                break;
            case "rps":
                msg += "[猜拳]";
                break;
            case "dice":
                msg += "[骰子]";
                break;
        }
    }
    return msg;
}

// 图片预览
$(document).ready(function () {
    $("body").on("mouseenter", ".chat-img", function() {
        const url = $(this).attr("href");
        $("#img-preview").attr("src", url);
        $("#img-preview").css("left", $(this).offset().left + 20 + "px");
        $("#img-preview").css("top", $(this).offset().top - 5 + "px");
        $("#img-preview").show();
    });
    $("body").on("mouseleave", ".chat-img", function() {
        $("#img-preview").hide();
    });
});
