/**
 * @type {import("vscode").Webview}
 */
const vscode = acquireVsCodeApi();

let me = Number(document.querySelector("env").attributes.self_id.value);
let c2c = document.querySelector("env").attributes.c2c.value == "1";
let uin = Number(document.querySelector("env").attributes.target_id.value);

// 监听来自vscode的消息
window.addEventListener("message", async function (event) {
    if (!event.data.echo) {
        // 消息和通知事件
        if (event.data.post_type === "message") {
            document.querySelector("#console").insertAdjacentHTML("beforeend", genUserMessage(event.data));
        } else if (event.data.post_type === "notice") {
            document.querySelector("#console").insertAdjacentHTML("beforeend", genSystemMessage(event.data));
        }
        scroll(0, document.body.scrollHeight);
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

function sendMsg() {
    const message = document.querySelector("#commandline").value;
    if (!message) {
        return;
    }
    callApi(c2c ? "sendPrivateMsg" : "sendGroupMsg", [uin, message]).then((data) => {
        if (data.retcode > 1) {
            document.querySelector("#console").insertAdjacentHTML("beforeend", `<div class="cmsg">
    <span class="name">
        <font color="red">[ERROR]</font>
        - ${new Date} - ${data.error?.message}
    </span>
</div>`);
            return;
        }
        if (c2c && data.data.message_id) {
            const html = `<div class="cmsg">
    <span class="name">
        <font color="green">[INFO]</font>
        - ${new Date} -
        me<${me}>:
    </span><br>
    <pre class="content">${filterXss(message)}</pre>
</div>`;
            document.querySelector("#console").insertAdjacentHTML("beforeend", html);
        }
        document.querySelector("#commandline").value = "";
    }).catch(() => {
        document.querySelector("#commandline").value = "";
    }).finally(() => {
        scroll(0, document.body.scrollHeight);
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
 * 生成一般消息
 * @param {import("oicq").PrivateMessageEventData | import("oicq").GroupMessageEventData} data 
 */
function genUserMessage(data) {
    return `<div class="cmsg">
    <span class="name">
        <font color="green">[INFO]</font>
        - ${new Date(data.time*1000)} -
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
        // updateMemberList();
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
        - ${new Date(data.time*1000)} - ${msg}
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
(()=>{
    document.querySelector("body").insertAdjacentHTML("beforeend", `<div id="container">
    <div id="console"></div>
    <textarea id="commandline" rows="1" type="text" name="command_line" placeholder=" send by Ctrl+Enter"></textarea>
</div>`);
    callApi("getChatHistory", ["", 10]).then((data) => {
        let html = "";
        let tmp = [];
        for (let msg of data.data) {
            if (!tmp.includes(msg.message_id)) {
                tmp.push(msg.message_id);
                html += genUserMessage(msg);
            }
        }
        if (!html) {
            return;
        }
        document.querySelector("#console").insertAdjacentHTML("afterbegin", html);
        scroll(0, document.body.scrollHeight);
    });
})();
