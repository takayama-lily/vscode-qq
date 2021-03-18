import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { ctx, client, setClient } from "./global";
import { genConfig, writeAccount, writePassword, openConfigFile } from "./config";
import { initLists } from "./explorer";

let logining = false;
let selected_status: number = 11;
const status_map: {[k: number]: string} = {
    11: "我在线上",
    60: "Q我吧",
    31: "离开",
    50: "忙碌",
    70: "请勿打扰",
    41: "隐身",
    0: "离线",
    98: "@切换账号",
    99: "@设置",
};

/**
 * create the instance
 */
function createClient(uin: number) {
    const c = oicq.createClient(uin, genConfig());
    setClient(c);

    client.on("system.login.error", function (data) {
        logining = false;
        vscode.window.showErrorMessage(data.message);
        if (data.message.includes("密码错误")) {
            writeAccount(0);
            writePassword("");
        }
    }); 
    client.on("system.login.slider", function (data) {
        vscode.window.showInformationMessage(`[点我](${data.url}) 完成滑动验证码并获取ticket (按F12查看网络请求以获取)`);
        inputTicket();
    });
    client.on("system.login.device", function (data) {
        const webview = vscode.window.createWebviewPanel("device", "[QQ]需要验证设备安全性 (完成后请关闭)", -1, {
            enableScripts: true,
            enableCommandUris: true
        });
        webview.webview.html = `<script>location.href="${data.url}";</script>`;
        webview.reveal();
        webview.onDidDispose(()=>{
            client.login();
        });
    });
    client.on("system.offline", (data)=>{
        logining = false;
        vscode.window.showErrorMessage(data.message);
    });
    client.on("system.online", function () {
        logining = false;
        if (selected_status !== 11)
            this.setOnlineStatus(selected_status);
        writeAccount(this.uin);
        writePassword(this.password_md5.toString("hex"));
        vscode.window.showInformationMessage(`QQ: ${client.nickname}(${client.uin}) 已上线`);
        initLists();
    });

    inputPassword();
}

/**
 * input account
 */
function inputAccount() {
    const uin = genConfig().account;
    if (uin > 10000 && uin < 0xffffffff) {
        return createClient(uin);
    }
    vscode.window.showInputBox({
        prompt: "请输入你的QQ账号",
    }).then((uin)=>{
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
    const password = genConfig().password;
    if (password) {
        return client.login(password);
    }
    vscode.window.showInputBox({
        prompt: `输入QQ号 ${client.uin} 的密码`,
        password: true
    }).then((pass)=>{
        if (!pass) {
            return;
        }
        const password = crypto.createHash("md5").update(pass).digest("hex");
        logining = true;
        client.login(password);
    });
}

/**
 * input ticket from slider catpcha
 */
function inputTicket() {
    vscode.window.showInputBox({prompt: "输入验证码ticket"})
        .then((ticket)=>{
            if (!ticket) {
                inputTicket();
            } else {
                client.sliderLogin(ticket);
            }
        });
}

export function invoke() {
    const tmp = { ...status_map };
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
                writeAccount(0);
                writePassword("");
                return inputAccount();
            }
            if (value?.includes("离线")) {
                client?.logout();
            } else if (value) {
                const i = arr.indexOf(value);
                selected_status = Number(Object.keys(status_map)[i]);
                if (client && client.password_md5) {
                    if (!client.isOnline())
                        client.login();
                    else
                        client.setOnlineStatus(selected_status);
                } else {
                    inputAccount();
                }
            }
        });
}