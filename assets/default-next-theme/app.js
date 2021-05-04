/**
 * window.webview 是一个内置全局变量，封装了一些与宿主交互的方法
 * @type {import("../types").Webview}
 */
var webview;

let me = webview.self_uin;
let c2c = webview.c2c;
let uin = webview.target_uin;
let nick = webview.nickname;
let facePath = webview.faces_path;

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

// 监听消息和通知
webview.on("message", (data) => {
    appendMsg(genUserMessage(data.detail));
});
webview.on("notice", (data) => {
    appendMsg(genSystemMessage(data.detail));
});
webview.on("insert-image", (data) => {
    for (const file of data.detail) {
        addImage(file);
    }
});

function appendMsg(msg) {
    if (document.querySelector(".content-left").scrollTop + document.querySelector(".content-left").offsetHeight + 100 > document.querySelector(".content-left").scrollHeight) {
        var flag = 1;
    }
    document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", msg);
    if (flag) {
        document.querySelector(".content-left").scroll(0, document.querySelector(".content-left").scrollHeight);
    }
}

async function updateMemberList() {
    ginfo = (await webview.getGroupInfo(uin)).data;
    const arr = (await webview.getGroupMemberList(uin)).data;
    members = new Map;
    const element = document.querySelector(".group-members");
    element.innerHTML = "";
    let owner_html = "";
    for (let v of arr) {
        members.set(v.user_id, v);
        const role = v.role === "owner" ? "🟡" : (v.role === "admin" ? "🟢" : "");
        const html = `<p title="${filterXss(v.nickname)}(${v.user_id})" class="group-member" uid="${v.user_id}">${role + filterXss(v.card || v.nickname)}</p>`;
        if (v.role === "owner") {
            owner_html = html;
            continue;
        }
        element.insertAdjacentHTML(v.role === "member" ? "beforeend" : "afterbegin", html);
    }
    element.insertAdjacentHTML("afterbegin", owner_html);
}

function getChatHistory(message_id = "", count = 20) {
    webview.getChatHistory(message_id, count).then((data) => {
        let html = "";
        let tmp = [];
        for (let msg of data.data) {
            if (msg.message_id !== message_id && !tmp.includes(msg.message_id)) {
                tmp.push(msg.message_id);
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
            document.querySelector(".content-left").scroll(0, document.querySelector(".content-left").scrollHeight);
        }
    });
}

function getEditorCQMessage() {
    let result = '';
    let currentChild = document.querySelector("#content").firstChild;
    while (currentChild) {
        console.log(currentChild, currentChild.nodeName);
        switch (currentChild.nodeType) {
            case Node.ELEMENT_NODE:
            {
                switch (currentChild.nodeName) {
                    case 'IMG':
                    {
                        switch (currentChild.getAttribute('oicq-type')) {
                            case 'image':
                            {
                                const data = currentChild.src.match(/data:image(\/.+?)?;base64,(?<data>.*)/);
                                if (data) {
                                    result += "[CQ:image,file=base64://" + data.groups.data + "]";
                                } else {
                                    result += "[CQ:image,file=" + currentChild.src + "]";
                                }
                                break;
                            }
                            case 'face':
                            {
                                const id = currentChild.getAttribute('oicq-face-id');
                                result += "[CQ:face,id=" + id + "]";
                                break;
                            }
                        }
                    }
                }
                break;
            }
            case Node.TEXT_NODE: // TEXT_NODE
            {
                result += currentChild.nodeValue;
                break;
            }
        }
        currentChild = currentChild.nextSibling;
    }
    return result;
}

let sending = false;
function sendMsg() {
    const message = getEditorCQMessage();
    if (sending || message.length === 0) {
        return;
    }
    sending = true;
    document.querySelector("#send").disabled = true;
    webview.sendMsg(message).then((data) => {
        if (data.retcode > 1) {
            let msg = data.error?.message;
            if (msg?.includes("禁言")) {
                if (ginfo.shutup_time_me * 1000 > Date.now()) {
                    msg += " (至" + datetime(ginfo.shutup_time_me) + ")";
                } else if (ginfo.shutup_time_whole) {
                    msg += " (全员禁言)";
                }
            } else if (data.retcode === 104) {
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
        document.querySelector("#content").innerHTML = "";
        currentTextareaContent = "";
    }).catch(() => {
        document.querySelector("#content").innerHTML = "";
    }).finally(() => {
        sending = false;
        document.querySelector("#send").disabled = false;
        document.querySelector(".content-left").scroll(0, document.querySelector(".content-left").scrollHeight);
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
            case "poke":
                msg = `${data.operator_id} ${data.action} ${data.target_id} ${data.suffix}`;
                break;
            case "recall":
                msg = `有人想撤回 <a href="#${data.message_id}">一条消息</>`;
                appendRecalledText(data.message_id);
                break;
        }
    } else if (data.notice_type === "group") {
        switch (data.sub_type) {
            case "recall":
                msg = `${genLabel(data.operator_id)} 撤回了 ${data.user_id === data.operator_id ? "自己" : genLabel(data.user_id)} 的<a href="#${data.message_id}">一条消息</>`;
                appendRecalledText(data.message_id);
                break;
            case "increase":
                msg = `${filterXss(data.nickname)}(${data.user_id}) 加入了群聊`;
                updateMemberList();
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
                updateMemberList();
                break;
            case "admin":
                msg = `${genLabel(data.user_id)} ${data.set ? "成为了" : "被取消了"}管理员`;
                updateMemberList();
                break;
            case "transfer":
                msg = `${genLabel(data.operator_id)} 将群主转让给了 ${genLabel(data.user_id)}`;
                updateMemberList();
                break;
            case "ban":
                if (data.user_id > 0) {
                    msg = `${genLabel(data.operator_id)} 禁言 ${data.user_id === 80000000 ? "匿名用户(" + data.nickname + ")" : genLabel(data.user_id)} ${~~(data.duration / 60)}分钟`;
                } else {
                    msg = `${genLabel(data.operator_id)} ${data.duration > 0 ? "开启" : "关闭"}了全员禁言`;
                }
                updateMemberList();
                break;
            case "poke":
                msg = `${genLabel(data.operator_id)} ${data.action} ${genLabel(data.user_id)} ${data.suffix}`;
                break;
            case "setting":
                if (data.group_name) {
                    msg = `群名已变更为 ` + data.group_name;
                }
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
    <span uid="${data.user_id}" ondblclick="addAt(${data.user_id})" class="name" title="${filterXss(data.sender.nickname)}(${data.user_id}) ${datetime(data.time)}">
        ${c2c ? "" : '<b class="operation">...</b>'}
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
    return webview.getUserAvaterUrlSmall(user_id);
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
                let split = v.data.file.split("-");
                let width = parseInt(split[1]), height = parseInt(split[2]);
                msg += `<a href="${v.data.url}&file=${v.data.file}&vscodeDragFlag=1" target="_blank" onmouseenter="previewImage(this,${width},${height})">${v.type === "image" ? "图片" : "闪照"}</a>`;
                break;
            case "record":
                msg = `<a href="${v.data.url}" target="_blank">语音消息</a>`;
                break;
            case "video":
                msg = `<a href="${v.data.url}" target="_blank">视频消息</a>`;
                break;
            case "xml":
                if (v.data.type === 35) {
                    try {
                        const resid = /resid="[^"]+"/.exec(v.data.data)[0].replace("resid=\"", "").replace("\"", "");
                        msg = `<a href="javascript:void(0)" onclick="triggerForwardMsg(this)" id="${resid}">[合并转发]</a><span class="msg-forward"></span>`;
                    } catch {
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[嵌套转发]</a><span style="display:none">${filterXss(v.data.data)}</span>`;
                    }
                } else {
                    msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[XML卡片消息]</a><span style="display:none">${filterXss(v.data.data)}</span>`;
                }
                break;
            case "json":
                msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[JSON卡片消息]</a><span style="display:none">${filterXss(JSON.stringify(JSON.parse(v.data.data), null, 4))}</span>`;
                break;
            case "file":
                msg = `<a href="${v.data.url}" target="_blank">文件: ${filterXss(v.data.name)} (${v.data.size / 1e6}MB)</a>`;
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
                msg = "[窗口抖动]";
                break;
            case "poke":
                msg = "[戳一戳]";
                break;
        }
    }
    return msg;
}

/**
 * 加入at元素到输入框
 * @param {number|"all"} uid 
 */
function addAt(uid) {
    if (c2c) {
        return;
    }
    const cqcode = `[CQ:at,qq=${uid}] `;
    addStr2Textarea(cqcode);
}

/**
 * 加入表情到输入框
 * @param {number} id 
 */
function addFace(id) {
    const child = document.createElement('img');
    child.setAttribute('oicq-type', 'face');
    child.setAttribute('oicq-face-id', id);
    child.src = facePath + id + '.png';
    insertToEditor(child);
}

/**
 * 加入图片到输入框
 * @param {string} file 
 */
function addImage(file) {
    const child = document.createElement('img');
    child.setAttribute('oicq-type', 'image');
    child.src = file;
    insertToEditor(child);
}

/**
 * 根据用户选区插入元素/替换选区到编辑器内
 * @param {Node | string} el 
 */
function insertToEditor(el) {
    let insertEl = el;
    if (typeof el === 'string') {
        insertEl = document.createTextNode(el);
    }
    const editorEl = document.querySelector('#content');
    const selection = getSelection();
    console.log(selection);
    console.log(selection.focusNode.parentElement.id);
    if (editorEl.contains(selection.focusNode)) {
        // 根据光标位置/选中的区域替换/插入
        const range = selection.getRangeAt(0);
        console.log(range);
        range.deleteContents();
        range.insertNode(el);
        range.setStartAfter(el);
        range.setEndAfter(el);
    } else {
        // 在末尾插入
        document.querySelector('#content').appendChild(el);
        const range = selection.getRangeAt(0);
        console.log(range);
        range.setStartAfter(el);
        range.setEndAfter(el);
    }
}

function addStr2Textarea(str) {
    insertToEditor(document.createTextNode(str));
}

document.querySelector("body").insertAdjacentHTML("beforeend", `
<div class="chatbox">
    <div class="content-left">
        <div class="lite-chatbox">
            <div class="tips">
                <span ondblclick='getChatHistory(document.querySelector(".msgid")?.attributes.id.value ?? "");'>双击加载历史消息</span>
            </div>
        </div>
        <div class="lite-chatbox" id="lite-chatbox">
            <img id="img-preview" style="z-index: 999;">
            <div class="menu-msg">
                <div class="menu-msg-reply">回复</div>
                <div class="menu-msg-at">@ TA</div>
                <div class="menu-msg-poke">戳一戳</div>
                <div class="menu-msg-recall">撤回消息</div>
                <div class="menu-msg-mute">禁言</div>
                <div class="menu-msg-kick">从本群中删除</div>
            </div>
        </div>
        <div class="modal-dialog">
            <div class="modal-title"></div>
            <div class="modal-button">
                <button class="modal-confirm">确定</button>　<button onclick="closeModalDialog()">取消</button>
            </div>
        </div>
        <div id="footer">
            <div id="content" placeholder="在此输入消息..." contenteditable="true"></div>
            <div id="footer-controls">
                <button id="send" class="button-primary" onclick="sendMsg()">发送 (Ctrl + Enter)</button> 
                <span id="show-stamp-box" class="button-secondary"><i class="icon icon-heart secondary-button"></i></span>
                <div class="stamp-box box"></div>
                <span id="show-face-box" class="button-secondary"><i class="icon icon-smiley secondary-button"></i></span>
                <div class="face-box box"></div>
                <span id="show-emoji-box" class="button-secondary">颜</span>
                <div class="emoji-box box"></div>
                <span id="insert-pic" class="button-secondary"><i class="icon icon-file-image secondary-button"></i></span>
                <span class="spacer"></span>
                ${c2c ? "" : '<span id="to-bottom" class="button-secondary end" onclick="triggerRightBar()">显示/隐藏侧栏</span>'}
            </div>
        </div>
    </div>
    <div class="content-right">
        <div class="group-info">
            <img class="headIcon radius" src="${webview.getGroupAvaterUrlSmall(webview.target_uin)}">
        </div>
        <div class="group-members"></div>
        <div class="menu-member">
            <div class="menu-member-at">@ TA</div>
            <div class="menu-member-poke">戳一戳</div>
            <div class="menu-member-admin1">设置为管理员</div>
            <div class="menu-member-admin0">取消管理员</div>
            <div class="menu-member-mute">禁言</div>
            <div class="menu-member-kick">从本群中删除</div>
        </div>
    </div>
</div>
`);

const idPreviewElement = document.querySelector("#img-preview");
const idShowStampBox = document.querySelector('#show-stamp-box');
const idShowFaceBox = document.querySelector('#show-face-box');
const idShowEmojiBox = document.querySelector('#show-emoji-box');

// add face to document
let tmpFaceStep = 0;
for (let i = 0; i <= 310; ++i) {
    if (i === 275 || (i > 247 && i < 260)) {
        continue;
    }
    ++tmpFaceStep;
    let html = `<img onclick="addFace(${i})" style="margin:5px;cursor:pointer" width="28" height="28" src="${facePath + i + ".png"}">` + (tmpFaceStep % 12 === 0 ? "<br>" : "");
    document.querySelector('.face-box').insertAdjacentHTML("beforeend", html);
}
document.querySelector("body").addEventListener("click", (e) => {
    document.querySelector('.face-box').style.display = 'none';
    document.querySelector('.emoji-box').style.display = 'none';
    document.querySelector('.stamp-box').style.display = 'none';
    document.querySelector('.menu-msg').style.display = 'none';
    document.querySelector('.menu-member').style.display = 'none';
    if (e.target === idShowStampBox) {
        document.querySelector('.stamp-box').style.display = 'block';
        if (!document.querySelector('.stamp-box img')) {
            // add stamp to document
            webview.getRoamingStamp().then((data) => {
                if (data.retcode === 0) {
                    let tmpStampStep = 0;
                    for (let i = data.data.length - 1; i >= 0; --i) {
                        ++tmpStampStep;
                        const url = data.data[i];
                        let html = `<img onclick="addImage('${url}')" src="${url}">` + (tmpStampStep % 6 === 0 ? "<br>" : "");
                        document.querySelector('.stamp-box').insertAdjacentHTML("beforeend", html);
                    }
                }
            });
        }
    } else if (e.target === idShowFaceBox) {
        document.querySelector('.face-box').style.display = 'block';
    } else if (e.target === idShowEmojiBox) {
        document.querySelector('.emoji-box').style.display = 'block';
    } else if (e.target.classList.contains("operation")) {
        const msgid = e.target.parentNode.parentNode.previousElementSibling.id;
        document.querySelector('.menu-msg').style.left = e.target.getBoundingClientRect().x + 12 + "px";
        document.querySelector('.menu-msg').style.top = e.target.getBoundingClientRect().y + "px";
        document.querySelector('.menu-msg').style.display = 'block';
        document.querySelector('.menu-msg .menu-msg-at').onclick = e.target.parentNode.ondblclick;
        document.querySelector('.menu-msg .menu-msg-reply').onclick = () => {
            addStr2Textarea(`[CQ:reply,id=${msgid}]`);
            e.target.parentNode.ondblclick();
        };
        document.querySelector('.menu-msg .menu-msg-recall').onclick = () => {
            showModalDialog("确定撤回此消息？", () => {
                webview.deleteMsg(msgid);
            });
        };
        const uid = Number(e.target.parentNode.attributes.uid.value);
        const member = members.get(uid);
        const label = filterXss(member?.card || member?.nickname || "未知用户") + "(" + uid + ")";
        document.querySelector('.menu-msg .menu-msg-mute').onclick = () => {
            showModalDialog(`禁言以下成员 <input id="mute-minutes" size="1" maxlength="5" value="10"> 分钟<br>` + label, () => {
                const duration = document.querySelector("#mute-minutes").value;
                if (duration >= 0) {
                    webview.setGroupBan(webview.target_uin, uid, Number(duration) * 60);
                }
            });
        };
        document.querySelector('.menu-msg .menu-msg-kick').onclick = () => {
            showModalDialog(`确定要删除以下成员：<br>` + label, () => {
                webview.setGroupKick(webview.target_uin, uid);
            });
        };
        document.querySelector('.menu-msg .menu-msg-poke').onclick = () => {
            webview.sendGroupPoke(webview.target_uin, uid);
        };
    } else if (e.target.classList.contains("group-member")) {
        document.querySelector('.menu-member').style.left = e.target.getBoundingClientRect().x + 50 + "px";
        document.querySelector('.menu-member').style.top = e.target.getBoundingClientRect().y + 10 + "px";
        document.querySelector('.menu-member').style.display = 'block';
        const uid = Number(e.target.attributes.uid.value);
        const member = members.get(uid);
        const label = filterXss(member?.card || member?.nickname || "未知用户") + "(" + uid + ")";
        document.querySelector('.menu-member .menu-member-poke').onclick = () => {
            webview.sendGroupPoke(webview.target_uin, uid);
        };
        document.querySelector('.menu-member .menu-member-at').onclick = () => {
            addAt(uid);
        };
        document.querySelector('.menu-member .menu-member-mute').onclick = () => {
            showModalDialog(`禁言以下成员 <input id="mute-minutes" size="1" maxlength="5" value="10"> 分钟<br>` + label, () => {
                const duration = document.querySelector("#mute-minutes").value;
                if (duration >= 0) {
                    webview.setGroupBan(webview.target_uin, uid, Number(duration) * 60);
                }
            });
        };
        document.querySelector('.menu-member .menu-member-kick').onclick = () => {
            showModalDialog(`确定要删除以下成员：<br>` + label, () => {
                webview.setGroupKick(webview.target_uin, uid);
            });
        };
        document.querySelector('.menu-member .menu-member-admin1').onclick = () => {
            webview.setGroupAdmin(webview.target_uin, uid, true);
        };
        document.querySelector('.menu-member .menu-member-admin0').onclick = () => {
            webview.setGroupAdmin(webview.target_uin, uid, false);
        };
    }
});
document.querySelector("#insert-pic").addEventListener("click", () => {
    webview.openImageDialog();
});

let tmpEmojiStep = 0;
function addEmoji2Box(from, to) {
    for (let i = from; i <= to; ++i) {
        ++tmpEmojiStep;
        let str = String.fromCodePoint(i);
        let html = `<span onclick="addStr2Textarea('${str}')" style="cursor:pointer">` + str + (tmpEmojiStep % 18 === 0 ? "</span><br>" : "</span>");
        document.querySelector('.emoji-box').insertAdjacentHTML("beforeend", html);
    }
}
addEmoji2Box(0x1F600, 0x1F64F);
addEmoji2Box(0x1F90D, 0x1F945);
addEmoji2Box(0x1F400, 0x1F4FF);
addEmoji2Box(0x1F300, 0x1F320);
addEmoji2Box(0x1F32D, 0x1F394);
addEmoji2Box(0x1F3A0, 0x1F3FA);
addEmoji2Box(0x1F680, 0x1F6C5);
addEmoji2Box(0x1F004, 0x1F004);

/**
 * 图片预览
 * @param {Element} obj 
 */
function previewImage(obj, width, height) {
    const url = obj.href ?? obj.src.replace("100", "640");
    if (width > 0 && width <= 200) {
        width = width + "px";
        height = "auto";
    } else if (height > 0 && height <= 200) {
        width = "auto";
        height = height + "px";
    } else if (height > 200 && width > 200) {
        if (width >= height) {
            width = "auto";
            height = "200px";
        } else {
            width = "200px";
            height = "auto";
        }
    } else {
        width = "200px";
        height = "auto";
    }
    idPreviewElement.style.width = width;
    idPreviewElement.style.height = height;
    let left = obj.getBoundingClientRect().x + 20;
    if (left + 150 > window.innerWidth) {
        left -= 200;
    }
    let top = obj.getBoundingClientRect().y - 5;
    idPreviewElement.src = url;
    idPreviewElement.style.left = left + "px";
    idPreviewElement.style.top = top + "px";
    idPreviewElement.style.display = "block";
    obj.onmouseleave = () => idPreviewElement.style.display = "none";
}

// Ctrl+Enter
window.onkeydown = function (event) {
    if (event.ctrlKey && event.keyCode === 13) {
        sendMsg();
    }
};

//滚动到顶部加载消息
document.querySelector(".content-left").onscroll = function () {
    if (document.querySelector(".content-left").scrollTop === 0) {
        getChatHistory(document.querySelector(".msgid")?.attributes.id.value ?? "");
    }
};

//表情、图片拖动
document.querySelector("#content").oninput = function () {
    const content = this.value;
    const diff = content.substr(this.value.length);
    if (diff.startsWith(facePath)) {
        const faceId = diff.substr(facePath.length).split(".")[0];
        const cqcode = `[CQ:face,id=${faceId}]`;
        addStr2Textarea(cqcode);
    } else if (diff.endsWith("&vscodeDragFlag=1")) {
        const file = new URL(diff).searchParams.get("file");
        // const cqcode = `[CQ:image,file=${file}]`;
        addImage(file);
    } else {
        currentTextareaContent = content;
    }
};

document.querySelector("#content").onpaste = function (event) {
    var items = (event.clipboardData || event.originalEvent.clipboardData).items;
    console.log(items); // will give you the mime types
    for (index in items) {
        var item = items[index];
        if (item.kind === 'file') {
            var blob = item.getAsFile();
            var reader = new FileReader();
            reader.onload = function (evt) {
                const result = evt.target.result;
                addImage(result);
            }; // data url!
            reader.readAsDataURL(blob);
        }
    }
};

function timestamp(unixstamp) {
    return webview.timestamp(unixstamp);
}
function datetime(unixstamp) {
    return webview.datetime(unixstamp);
}

function showModalDialog(title, cb) {
    document.querySelector(".modal-title").innerHTML = title;
    document.querySelector(".modal-dialog").style.display = "block";
    document.querySelector(".modal-dialog").style.top = window.innerHeight / 2 - 50 + "px";
    document.querySelector(".modal-dialog").style.left = window.innerWidth / 2 - 100 + "px";
    document.querySelector(".modal-confirm").onclick = cb;
}
function closeModalDialog() {
    document.querySelector(".modal-dialog").style.display = "none";
}
document.querySelector(".modal-confirm").addEventListener("click", closeModalDialog);

function triggerRightBar() {
    if (c2c) {
        return;
    }
    if (document.querySelector(".content-right").style.display === "block") {
        document.querySelector(".content-right").style.display = "none";
    } else {
        document.querySelector(".content-right").style.display = "block";
    }
}

function triggerForwardMsg(obj) {
    const resid = obj.id;
    const elememt = obj.nextElementSibling;
    if (elememt.style.display === "block") {
        elememt.style.display = "none";
    } else {
        elememt.style.display = "block";
    }
    if (elememt.innerHTML === "" || elememt.innerHTML === "加载失败") {
        elememt.innerHTML = "...";
        webview.getForwardMsg(resid).then(data => {
            let html = "";
            for (let v of data.data) {
                html += `<p>👤${filterXss(v.nickname)}(${v.user_id}) ${datetime(v.time)}</p>${parseMessage(v.message)}`;
            }
            if (!html) {
                html = "加载失败";
            }
            elememt.innerHTML = html;
        });
    }
}

//init
(async () => {
    if (!c2c) {
        //加载群资料、群员列表
        await updateMemberList();
    }
    //加载历史消息
    getChatHistory();
})();
