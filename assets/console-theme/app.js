/**
 * window.webview 是一个内置全局变量，封装了一些与宿主交互的方法
 * @type {import("../types").Webview}
 */
var webview;

// 监听消息和通知
webview.on("message", (data) => {
    const msg = data.detail;
    document.querySelector("#console").insertAdjacentHTML("beforeend", genUserMessage(msg));
    webview.scrollEnd();
});
webview.on("notice", (data) => {
    const msg = data.detail;
    document.querySelector("#console").insertAdjacentHTML("beforeend", genSystemMessage(msg));
    webview.scrollEnd();
});

function sendMsg() {
    const message = document.querySelector("#commandline").value;
    if (!message) {
        return;
    }
    webview.sendMsg(message).then((data) => {
        // 发送失败
        if (data.retcode > 1) {
            document.querySelector("#console").insertAdjacentHTML("beforeend", `<div class="cmsg">
    <span class="name">
        <font color="red">[ERROR]</font>
        - ${new Date} - ${data.error?.message}
    </span>
</div>`);
            return;
        }

        // 私聊需要自己打印消息
        if (webview.c2c && data.data.message_id) {
            const html = `<div class="cmsg">
    <span class="name">
        <font color="green">[INFO]</font>
        - ${webview.datetime()} -
        me<${webview.self_uin}>:
    </span><br>
    <pre class="content">${filterXss(message)}</pre>
</div>`;
            document.querySelector("#console").insertAdjacentHTML("beforeend", html);
        }
        document.querySelector("#commandline").value = "";
    }).catch(() => {
        document.querySelector("#commandline").value = "";
    }).finally(() => {
        webview.scrollEnd();
    });
}

/**
 * xss过滤
 * @param {string} str 
 */
function filterXss(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 生成聊天消息
 * @param {import("oicq").PrivateMessageEventData | import("oicq").GroupMessageEventData} data 
 */
function genUserMessage(data) {
    return `<div class="cmsg">
    <span class="name">
        <font color="green">[INFO]</font>
        - ${webview.datetime(data.time)} -
        ${filterXss(data.sender.card ? data.sender.card : data.sender.nickname)}<${data.user_id}>:
    </span><br>
    <pre class="content">${filterXss(data.raw_message)}</pre>
</div>`;
}

/**
 * 生成系统消息
 * @param {import("oicq").GroupNoticeEventData | import("oicq").FriendNoticeEventData} data 
 */
function genSystemMessage(data) {
    let msg = "";
    if (data.notice_type === "group") {
        switch (data.sub_type) {
            case "increase":
                msg = `${data.user_id} joined the group.`;
                break;
            case "decrease":
                if (data.dismiss) {
                    msg = `This group is dismissed`;
                } else {
                    msg = `${data.user_id} left from the group`;
                }
                break;
            case "ban":
                if (data.user_id > 0)
                    msg = `${data.operator_id} muted ${data.user_id} ${data.duration} seconds.`;
                else
                    msg = `${data.operator_id} ${data.duration > 0 ? "enabled" : "disabled"} muteAll.`;
                break;
        }
    }
    if (!msg) {
        return "";
    }
    return `<div class="cmsg">
    <span class="name">
        <font color="orange">[NOTICE]</font>
        - ${webview.datetime(data.time)} - ${msg}
    </span>
</div>`;
}

// Ctrl+Enter
window.onkeydown = function (event) {
    if (event.ctrlKey && event.keyCode === 13) {
        sendMsg();
    }
};

//init
document.querySelector("body").insertAdjacentHTML("beforeend", `<div id="container">
    <div id="console"></div>
    <textarea id="commandline" rows="1" type="text" name="command_line" placeholder=" send by Ctrl+Enter"></textarea>
</div>`);

//加载10条历史消息
webview.getChatHistory("", 10).then((data) => {
    let html = "";
    for (let msg of data.data) {
        html += genUserMessage(msg);
    }
    document.querySelector("#console").insertAdjacentHTML("afterbegin", html);
    webview.scrollEnd();
});
