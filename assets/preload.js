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
    const postMessage = acquireVsCodeApi().postMessage;

    const env = window.document.querySelector("env");
    vsc.self_id = Number(env.attributes.self_id?.value);
    vsc.nickname = String(env.attributes.nickname?.value);
    vsc.c2c = env.attributes.c2c?.value === "1";
    vsc.target_id = Number(env.attributes.target_id?.value);
    vsc.assets_path = env.attributes.path?.value + "/";
    vsc.faces_path = vsc.assets_path + "faces/";

    /**
     * @param {import("oicq").CommonEventData} data 
     */
    function onHostMessage(data) {
        if (!data.echo) {
            if (data.post_type === "message") {
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
                reject(new TimeoutError);
                handlers.delete(echo);
            }, 5000);
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
    ];

    for (let name of available_apis) {
        vsc[name] = (...args) => vsc.callApi(name, args);
    }

    window.webview = vsc;

})(window);
