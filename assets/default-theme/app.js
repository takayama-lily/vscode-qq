/**
 * @type {import("vscode").Webview}
 */
const vscode = acquireVsCodeApi();

let me = Number(document.querySelector("env").attributes.self_id.value);
let c2c = document.querySelector("env").attributes.c2c.value == "1";
let uin = Number(document.querySelector("env").attributes.target_id.value);
let nick = String(document.querySelector("env").attributes.nickname.value);

// 表情文件夹路径
let facePath = document.querySelector("env").attributes.path.value + "/faces/";

/**
 * 群员列表
 * @type {Map<number, import("oicq").MemberInfo>}
 */
let members = new Map;

/**
 * 群资料
 * @type {import("oicq").GroupInfo}
 */
let ginfo;

// 监听来自vscode的消息
window.addEventListener("message", async function (event) {
    if (!event.data.echo) {
        // 消息和通知事件
        if (window.innerHeight + window.scrollY + 100 > document.body.scrollHeight) {
            var flag = 1;
        }
        if (event.data.post_type === "message") {
            document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", genUserMessage(event.data));
        } else if (event.data.post_type === "notice") {
            document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", genSystemMessage(event.data));
        }
        if (flag) {
            scroll(0, document.body.scrollHeight);
        }
    } else {
        // api返回值
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
 * 发消息给vscode
 * @param {string} command 
 */
function callApi(command, params = []) {
    const echo = String(Date.now()) + String(Math.random());
    /**
     * @type {import("../../src/chat").WebViewPostData}
     */
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
    ginfo = (await callApi("getGroupInfo", [uin])).data;
    const arr = (await callApi("getGroupMemberList", [uin])).data;
    members = new Map;
    for (let v of arr) {
        members.set(v.user_id, v);
    }
}

function getChatHistory(message_id = "", count = 20) {
    callApi("getChatHistory", [message_id, count]).then((data) => {
        let html = "";
        for (let msg of data.data) {
            if (msg.message_id !== message_id) {
                html += genUserMessage(msg);
            }
        }
        if (!html) {
            return;
        }
        document.querySelector("#lite-chatbox").insertAdjacentHTML("afterbegin", html);
        if (message_id) {
            window.location.hash = "#" + message_id;
        } else {
            scroll(0, document.body.scrollHeight);
        }
    });
}

let sending = false;
function sendMsg() {
    const message = document.querySelector("#content").value;
    if (sending || !message) {
        return;
    }
    sending = true;
    document.querySelector("#send").disabled = true;
    callApi(c2c ? "sendPrivateMsg" : "sendGroupMsg", [uin, message]).then((data) => {
        if (data.retcode > 1) {
            let msg = data.error?.message;
            if (msg?.includes("禁言")) {
                if (ginfo.shutup_time_me * 1000 > Date.now()) {
                    msg += " (至" + datetime(ginfo.shutup_time_me) + ")";
                } else if (ginfo.shutup_time_whole) {
                    msg += " (全员禁言)";
                }
            } else if (msg === "bot not online") {
                msg = "断线了，发送失败";
            }
            document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", `<div class="tips">
    <span class="tips-danger">Error: ${msg}</span>
</div>`);
            return;
        }
        if (c2c && data.data.message_id) {
            const html = `<a class="msgid" id="${data.data.message_id}"></a><div class="cright cmsg">
    <img class="headIcon radius" onmouseenter="previewImage(this)" src="${genAvaterUrl(me)}" />
    <span class="name" title="${nick}(${me}) ${datetime()}">${nick} ${timestamp()}</span>
    <span class="content">${filterXss(message)}</span>
</div>`;
            document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", html);
        }
        document.querySelector("#content").value = "";
        currentTextareaContent = "";
    }).catch(() => {
        document.querySelector("#content").value = "";
        currentTextareaContent = "";
    }).finally(() => {
        sending = false;
        document.querySelector("#send").disabled = false;
        scroll(0, document.body.scrollHeight);
    });
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
                msg = `${genLabel(data.operator_id)} 撤回了 ${data.user_id === data.operator_id ? "自己" : genLabel(data.user_id)} 的<a href="#${data.message_id}">一条消息</>`;
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
                if (data.user_id > 0)
                    msg = `${genLabel(data.operator_id)} 禁言 ${data.user_id === 80000000 ? "匿名用户(" + data.nickname + ")" : genLabel(data.user_id)} ${data.duration}秒`;
                else
                    msg = `${genLabel(data.operator_id)} ${data.duration > 0 ? "开启" : "关闭"}了全员禁言`;
                break;
            case "poke":
                msg = `${genLabel(data.operator_id)} ${data.action} ${genLabel(data.user_id)} ${data.suffix}`;
                break;
        }
    }
    if (!msg) {
        return "";
    }
    return `<div class="tips" title="${datetime(data.time)}">
    <span>${msg}</span>
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
    return `<b title="${filterXss(member.nickname)} (${user_id})">${filterXss(member.card ? member.card : member.nickname)}</b>`;
}

/**
 * 转义message_id中的特殊字符
 * @param {string} message_id 
 */
function filterMsgIdSelector(message_id) {
    return message_id.replace(/\//g, "\\/").replace(/\=/g, "\\=").replace(/\+/g, "\\+");
}

/**
 * @param {string} message_id 
 */
function appendRecalledText(message_id) {
    document.querySelector("a[id=" + filterMsgIdSelector(message_id) + "]+div span")?.append(" (已撤回)");
}

/**
 * 生成一般消息
 * @param {import("oicq").PrivateMessageEventData | import("oicq").GroupMessageEventData} data 
 */
function genUserMessage(data) {
    if (document.querySelector("#" + filterMsgIdSelector(data.message_id))) {
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
    <img class="headIcon radius" onmouseenter="previewImage(this)" src="${genAvaterUrl(data.user_id)}" />
    <span ondblclick="addAt(${data.user_id})" class="name" title="${filterXss(data.sender.nickname)}(${data.user_id}) ${datetime(data.time)}">
        ${title}${filterXss(data.sender.card ? data.sender.card : data.sender.nickname)} ${timestamp(data.time)}
    </span>
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
                msg += filterXss(v.data.text);
                break;
            case "at":
                msg += `<a title="${v.data.qq}" href="javascript:void(0);" onclick="addAt('${v.data.qq}');">${filterXss(v.data.text)}</a>`;
                break;
            case "face":
                if (v.data.id > 310 || v.data.id === 275) {
                    msg += "[未知表情]";
                } else {
                    msg += `<img ondblclick="addFace(${v.data.id})" src="${facePath + v.data.id}.png">`;
                }
                break;
            case "sface":
            case "bface":
                if (v.data.text) {
                    msg += "[" + filterXss(v.data.text) + "]";
                } else {
                    msg += "[表情]";
                }
                break;
            case "image":
            case "flash":
                if (!c2c) {
                    v.data.url = v.data.url.replace(/\/[0-9]+\//, "/0/").replace(/[0-9]+-/g, "0-");
                }
                msg += `<a href="${v.data.url}&file=${v.data.file}&vscodeDragFlag=1" target="_blank" onmouseenter="previewImage(this)">${v.type === "image" ? "图片" : "闪照"}</a>`;
                break;
            case "record":
                msg += `<a href="${v.data.url}" target="_blank">[语音]</a>`;
                break;
            case "video":
                msg += `<a href="${v.data.url}" target="_blank">[视频]</a>`;
                break;
            case "xml":
                if (v.data.type === 35) {
                    msg += "[合并转发(暂不支持查看)]";
                } else {
                    msg += "[xml卡片]";
                }
                break;
            case "json":
                msg += "[json卡片]";
                break;
            case "file":
                msg += `<a href="${v.data.url}" target="_blank">[文件:${filterXss(v.data.name)}(${v.data.size / 1e6}MB)]</a>`;
                break;
            case "reply":
                if (message[1]?.type === "at" && message[3]?.type === "at" && message[1]?.data.qq === message[3]?.data.qq) {
                    message.splice(1, 2);
                }
                msg += `<a href="#${v.data.id}">[回复]</a>`;
                break;
            case "rps":
                msg += "[猜拳]";
                break;
            case "dice":
                msg += "[骰子]";
                break;
            case "shake":
                msg += "[窗口抖动]";
                break;
            case "poke":
                msg += "[戳一戳]";
                break;
        }
    }
    return msg;
}

/**
 * 双击加入at元素到输入框
 * @param {number|"all"} uid 
 */
function addAt(uid) {
    if (c2c) {
        return;
    }
    const cqcode = `[CQ:at,qq=${uid}] `;
    currentTextareaContent += cqcode;
    document.querySelector("#content").value = currentTextareaContent;
}

/**
 * 双击加入表情到输入框
 * @param {number} id 
 */
function addFace(id) {
    const cqcode = `[CQ:face,id=${id}]`;
    currentTextareaContent += cqcode;
    document.querySelector("#content").value = currentTextareaContent;
}

let currentTextareaContent = "";

document.querySelector("body").insertAdjacentHTML("beforeend", `<div class="lite-chatbox">
    <div class="tips">
        <span ondblclick='getChatHistory(document.querySelector(".msgid")?.attributes.id.value ?? "", 10);'>双击加载历史消息</span>
    </div>
</div>
<div class="lite-chatbox" id="lite-chatbox"></div>
<div style="width: 100%; height: 30px;"></div>
<img id="img-preview" style="z-index: 999;">
<div id="footer">
    <textarea id="content" rows="10" placeholder="在此输入消息..."></textarea>
    <button id="send" onclick="sendMsg()">发送</button>Ctrl+Enter　
    (发文字以外内容暂时只能使用<a href="https://github.com/takayama-lily/oicq/wiki/90.%E5%A6%82%E4%BD%95%E5%8F%91%E9%80%81%E5%A4%9A%E5%AA%92%E4%BD%93%E5%86%85%E5%AE%B9(CQ%E7%A0%81)" target="_blank">CQ码</a>)
    <span id="to-bottom" onclick="window.scroll(0, document.body.scrollHeight);">↓底部</span>
</div>`);

const previewElement = document.querySelector("#img-preview");
/**
 * 图片预览
 * @param {Element} obj 
 */
function previewImage(obj) {
    const url = obj.href ?? obj.src.replace("100", "640");
    let left = obj.getBoundingClientRect().x + 20;
    if (left + 150 > window.innerWidth) {
        left -= 200;
    }
    let top = obj.getBoundingClientRect().y - 5;
    previewElement.src = url;
    previewElement.style.left = left + "px";
    previewElement.style.top = top + "px";
    previewElement.style.display = "block";
    obj.onmouseleave = () => previewElement.style.display = "none";
}

// Ctrl+Enter
window.onkeydown = function (event) {
    if (event.ctrlKey && event.keyCode === 13) {
        sendMsg();
    }
};

//滚动到顶部加载消息
window.onscroll = function () {
    if (window.scrollY === 0) {
        getChatHistory(document.querySelector(".msgid")?.attributes.id.value ?? "", 10);
    }
};

//表情、图片拖动
document.querySelector("#content").oninput = function () {
    const content = this.value;
    const diff = content.substr(currentTextareaContent.length);
    if (diff.startsWith(facePath)) {
        const faceId = diff.substr(facePath.length).split(".")[0];
        const cqcode = `[CQ:face,id=${faceId}]`;
        currentTextareaContent += cqcode;
        this.value = currentTextareaContent;
    } else if (diff.endsWith("&vscodeDragFlag=1")) {
        const file = new URL(diff).searchParams.get("file");
        const cqcode = `[CQ:image,file=${file}]`;
        currentTextareaContent += cqcode;
        this.value = currentTextareaContent;
    } else {
        currentTextareaContent = content;
    }
};

function timestamp(unixstamp) {
    const date = new Date(unixstamp ? unixstamp * 1000 : Date.now());
    return date.getHours()
        + ":"
        + String(date.getMinutes()).padStart(2, "0")
        + ":"
        + String(date.getSeconds()).padStart(2, "0");
    
}
function datetime(unixstamp) {
    const date = new Date(unixstamp ? unixstamp * 1000 : Date.now());
    return date.getFullYear()
        + "/"
        + String(date.getMonth()).padStart(2, "0")
        + "/"
        + String(date.getDate()).padStart(2, "0")
        + " "
        + timestamp(unixstamp);
}

//init
(async()=>{
    if (!c2c) {
        //加载群资料、群员列表
        await updateMemberList();
    }
    //加载历史消息
    getChatHistory();
})();
