import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { client, setClient } from "./global";
import { openConfigFile, deleteToken, genClientConfig, getConfig, setConfig } from "./config";
import { initLists } from "./explorer";
import { Cdp } from "./cdp";

let logining = false;
let selectedStatus: number = 11;
const statusMap: { [k: number]: string } = {
    11: "我在线上",
    60: "Q我吧",
    31: "离开",
    50: "忙碌",
    70: "请勿打扰",
    41: "隐身",
    0: "离线",
    97: "@个人资料",
    98: "@切换账号",
    99: "@设置",
};

/**
 * create the instance
 */
function createClient(uin: number) {
    const c = oicq.createClient(uin, genClientConfig());

    try {
        const stat = fs.statSync(path.join(c.dir, "online.lock"), { bigint: true });
        const diff = Date.now() - Number(stat.mtimeMs);
        if (diff >= 0 && diff < 10000) {
            vscode.window.showErrorMessage("你已经在另一个Code中登录了此账号。");
            return;
        }
    } catch { }

    setClient(c);

    client.on("system.login.error", function (data) {
        logining = false;
        if (data.message.includes("密码错误")) {
            setConfig({
                account: 0,
                password: ""
            });
            data.message += "(请选择：@切换账号)";
        }
        vscode.window.showErrorMessage(data.message);

    });
    client.on("system.login.qrcode", function (data) {
        const webview = vscode.window.createWebviewPanel("device", "手机QQ扫码登录 (完成后请关闭)", -1, {
            enableScripts: true,
            enableCommandUris: true
        });
        webview.webview.html = `若提示二维码已过期重试一次<br><img src="data:image/jpeg;base64,${data.image.toString("base64")}">`;
        webview.reveal();
        webview.onDidDispose(() => {
            client.login();
        });
    });
    client.on("system.login.slider", function (data) {
        const cdp = new Cdp;
        cdp.on("ticket", (ticket: string) => {
            client.sliderLogin(ticket);
        });
        cdp.on("error", (err: Symbol) => {
            vscode.window.showInformationMessage(`打开chrome失败，请 [点我](${data.url}) 完成滑动验证码并获取ticket (按F12查看网络请求以获取) [教程](https://github.com/takayama-lily/oicq/wiki/01.%E6%BB%91%E5%8A%A8%E9%AA%8C%E8%AF%81%E7%A0%81%E5%92%8C%E8%AE%BE%E5%A4%87%E9%94%81)`);
            inputTicket();
        });
        cdp.getTicket(data.url);
    });
    client.on("system.login.device", function (data) {
        const webview = vscode.window.createWebviewPanel("device", "[QQ]需要验证设备安全性 (完成后请关闭)", -1, {
            enableScripts: true,
            enableCommandUris: true
        });
        webview.webview.html = `<html style="height:100%"><body style="height:100%;padding:0"><iframe width="100%" height="100%" style="border:0" src="${data.url}"></iframe></body></html>`;
        webview.reveal();
        webview.onDidDispose(() => {
            client.login();
        });
        vscode.window.showInformationMessage(`[设备锁验证地址](${data.url}) 若vscode中无法正常显示可在浏览器中打开`);
    });
    client.on("system.offline", (data) => {
        logining = false;
        if (data.message.includes("服务器繁忙")) {
            data.message = "服务器繁忙，请过几秒后再次尝试。";
        }
        vscode.window.showErrorMessage(data.message);
    });
    client.on("system.online", function () {
        logining = false;
        if (selectedStatus !== 11) {
            this.setOnlineStatus(selectedStatus);
        }
        setConfig({
            account: this.uin,
            password: this.password_md5 ? this.password_md5.toString("hex") : "qrcode"
        });
        vscode.window.showInformationMessage(`${client.nickname}(${client.uin}) 已上线`);
        initLists();
    });

    inputPassword();
}

/**
 * input account
 */
function inputAccount() {
    const uin = Number(getConfig().account);
    if (uin > 10000 && uin < 0xffffffff) {
        return createClient(uin);
    }
    vscode.window.showInputBox({
        placeHolder: "输入QQ账号...",
    }).then((uin) => {
        if (!uin) {
            return;
        }
        try {
            createClient(Number(uin));
        } catch {
            inputAccount();
        }
    });
}

/**
 * input password of account
 */
function inputPassword() {
    const password = String(getConfig().password);
    if (password === "qrcode") {
        return client.login();
    } else if (password) {
        return client.login(password);
    }
    vscode.window.showInputBox({
        placeHolder: "输入密码... (扫码登录请留空)",
        prompt: `输入账号 ${client.uin} 的密码`,
        password: true
    }).then((pass) => {
        if (!pass) {
            return client.login();
        }
        const password = crypto.createHash("md5").update(pass).digest();
        logining = true;
        client.login(password);
    });
}

/**
 * input ticket from slider catpcha
 */
function inputTicket() {
    vscode.window.showInputBox({ placeHolder: "输入验证码ticket" })
        .then((ticket) => {
            if (!ticket) {
                inputTicket();
            } else {
                client.sliderLogin(ticket);
            }
        });
}

function showProfile() {
    const arr = [
        "账号：" + client.uin + " (点击复制)",
        "昵称：" + client.nickname + " (点击设置)",
        "性别：" + client.sex + " (点击设置)",
        "年龄：" + client.age + " (点击设置)",
        "个性签名 (点击设置)"
    ];
    vscode.window.showQuickPick(arr).then((value) => {
        switch (value) {
            case arr[0]:
                vscode.env.clipboard.writeText(`${client.nickname} (${client.uin})`);
                break;
            case arr[1]:
                vscode.window.showInputBox({ placeHolder: "输入新的昵称...", prompt: "当前昵称为：" + client.nickname})
                    .then((value) => {
                        if (value) {
                            client.setNickname(value);
                        }
                    });
                break;
            case arr[2]:
                vscode.window.showInputBox({ placeHolder: "输入性别数字...", prompt: "0: unknown; 1: male; 2: female"})
                    .then((value) => {
                        if (value) {
                            //@ts-ignore
                            client.setGender(Number(value));
                        }
                    });
                break;
            case arr[3]:
                vscode.window.showInputBox({ placeHolder: "输入生日...", prompt: "格式为：20020202"})
                    .then((value) => {
                        if (value) {
                            client.setBirthday(value);
                        }
                    });
                break;
            case arr[4]:
                vscode.window.showInputBox({ placeHolder: "输入个性签名..."})
                    .then((value) => {
                        if (value) {
                            client.setSignature(value);
                        }
                    });
                break;
        }
    });
}

export function invoke() {
    const tmp = { ...statusMap };
    if (!client || !client.isOnline()) {
        tmp[0] += " (当前)";
    } else {
        tmp[client.online_status] += " (当前)";
    }
    const arr = Object.values(tmp);
    vscode.window.showQuickPick(arr)
        .then((value) => {
            if (value === "@设置") {
                return openConfigFile();
            }
            if (logining) {
                vscode.window.showInformationMessage("正在登录中，请稍后...");
                return;
            }
            if (value === "@切换账号") {
                client?.logout();
                deleteToken();
                setConfig({
                    account: 0,
                    password: ""
                });
                return inputAccount();
            }
            if (value === "@个人资料") {
                if (client) {
                    showProfile();
                }
                return;
            }
            if (value?.includes("离线")) {
                client?.logout();
            } else if (value) {
                const i = arr.indexOf(value);
                selectedStatus = Number(Object.keys(statusMap)[i]);
                if (client) {
                    if (!client.isOnline()) {
                        client.login();
                    } else {
                        client.setOnlineStatus(selectedStatus);
                    }
                } else {
                    inputAccount();
                }
            }
        });
}
