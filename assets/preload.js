/**
 * 该文件在页面生成时自动加载
 */
;(() => {

    /**
     * @type {import("./types").Webview}
     */
    const vsc = new window.EventTarget;
    vsc.on = vsc.addEventListener;
    vsc.TimeoutError = class TimeoutError extends Error { };

    /**
     * @type {Map<string, Function>}
     */
    const handlers = new Map;

    /**
     * @type {Function}
     */
    const postMessage = window.acquireVsCodeApi().postMessage;
    window.acquireVsCodeApi = () => {
        return { postMessage };
    };

    const env = window.document.querySelector("env");
    vsc.self_uin = Number(env.attributes.self_id?.value);
    vsc.nickname = String(env.attributes.nickname?.value);
    vsc.c2c = env.attributes.c2c?.value === "1";
    vsc.target_uin = Number(env.attributes.target_id?.value);
    vsc.assets_path = env.attributes.path?.value + "/";
    vsc.faces_path = vsc.assets_path + "faces/";
    vsc.t = Number(env.attributes.t?.value);

    /**
     * @param {import("oicq").CommonEventData} data 
     */
    function onHostMessage(data) {
        if (!data.echo) {
            if (data.post_type === "message" || (data.post_type === "sync" && data.sync_type === "message")) {
                vsc.dispatchEvent(new window.CustomEvent("message", { detail: data }));
            } else if (data.post_type === "notice") {
                vsc.dispatchEvent(new window.CustomEvent("notice", { detail: data }));
            }
        } else {
            handlers.get(data?.echo)?.call(null, data);
            handlers.delete(data.echo);
        }
    }
    window.addEventListener("message", function (event) {
        onHostMessage(event.data);
    });

    vsc.callApi = (command, params = []) => {
        const echo = String(Date.now()) + String(Math.random());
        /**
         * @type {import("../src/chat").WebViewPostData}
         */
        const obj = {
            command, params, echo
        };
        return new Promise((resolve, reject) => {
            postMessage(obj);
            const id = setTimeout(() => {
                reject(new vsc.TimeoutError);
                handlers.delete(echo);
            }, 5500);
            handlers.set(echo, (data) => {
                clearTimeout(id);
                resolve(data);
            });
        });
    };

    /**
     * @type {Array<keyof import("oicq").Client>}
     */
    const available_apis = [
        "sendPrivateMsg", "sendGroupMsg", "deleteMsg", "getChatHistory",
        "sendGroupPoke", "setGroupCard", "setGroupAdmin", "setGroupSpecialTitle",
        "setGroupKick", "setGroupBan", "setGroupWholeBan", "setGroupAnonymousBan",
        "getForwardMsg", "getGroupInfo", "getGroupMemberList", "getGroupMemberInfo",
        "getStrangerInfo", "getGroupNotice", "getRoamingStamp", "getMsg"
    ];

    for (let name of available_apis) {
        vsc[name] = (...args) => vsc.callApi(name, args);
    }

    vsc.sendMsg = (message, auto_escape = false) => {
        const method = vsc.c2c ? "sendPrivateMsg" : "sendGroupMsg";
        return vsc.callApi(method, [vsc.target_uin, message, auto_escape]);
    };

    vsc.scrollHome = () => window.scroll(0, 0);
    vsc.scrollEnd = () => window.scroll(0, window.document.body.scrollHeight);
    vsc.getUserAvaterUrlSmall = (uin) => `https://q1.qlogo.cn/g?b=qq&s=100&nk=${uin}&t=` + vsc.t;
    vsc.getUserAvaterUrlLarge = (uin) => `https://q1.qlogo.cn/g?b=qq&s=640&nk=${uin}&t=` + vsc.t;
    vsc.getGroupAvaterUrlSmall = (uin) => `https://p.qlogo.cn/gh/${uin}/${uin}/100?t=` + vsc.t;
    vsc.getGroupAvaterUrlLarge = (uin) => `https://p.qlogo.cn/gh/${uin}/${uin}/640?t=` + vsc.t;

    vsc.timestamp = (unixstamp) => {
        const date = new Date(unixstamp ? unixstamp * 1000 : Date.now());
        return date.getHours()
            + ":"
            + String(date.getMinutes()).padStart(2, "0")
            + ":"
            + String(date.getSeconds()).padStart(2, "0");
    };
    vsc.datetime = (unixstamp) => {
        const date = new Date(unixstamp ? unixstamp * 1000 : Date.now());
        return date.getFullYear()
            + "/"
            + String(date.getMonth() + 1).padStart(2, "0")
            + "/"
            + String(date.getDate()).padStart(2, "0")
            + " "
            + vsc.timestamp(unixstamp);
    };

    window.webview = vsc;

})(window);
