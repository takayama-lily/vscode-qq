// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as oicq from 'oicq';
import * as crypto from 'crypto';
import * as fs from 'fs';

var qqStatusNow = "离线/切换账号";
var qqStatusMap = {
	"我在线上": 11,
	"Q我吧": 60,
	"离开": 31,
	"忙碌": 50,
	"请勿打扰": 70,
	"隐身": 41,
	"离线/切换账号": 0,
};
var qq: oicq.Client | null;
var statusBarItem: vscode.StatusBarItem;
var ctx: vscode.ExtensionContext;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// create work dir
	ctx = context;
	if (!fs.existsSync(ctx.globalStoragePath)) {
		fs.mkdirSync(ctx.globalStoragePath);
	}

	// creat status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "QQ";
	statusBarItem.command = "oicq.statusBar.click";
	vscode.commands.registerCommand("oicq.statusBar.click", () => {
		if (!qq) {
			const uin = ctx.globalState.get("defaultQQ");
			if (uin) {
				inputAccount(Number(uin));
			} else {
				return inputAccount();
			}
		}
		const arr = Object.keys(qqStatusMap);
		arr.forEach((v, i) => {
			if (v === qqStatusNow) {
				arr[i] += " (当前状态)";
			}
		});
		vscode.window.showQuickPick(arr)
			.then((value) => {
				if (value?.includes("离线")) {
					qq?.logout();
					qq = null;
					qqStatusNow = "离线/切换账号";
					ctx.globalState.update("defaultQQ", undefined);
					inputAccount();
				} else if (value) {
					// @ts-ignore
					qq?.setOnlineStatus(qqStatusMap[value]).then((data)=>{
						if (data.retcode === 0) {
							qqStatusNow = value;
						}
					});
				}
			});
	});

	statusBarItem.show();
}

// this method is called when your extension is deactivated
export function deactivate() {
	qq?.logout();
}

/**
 * init qq
 */
function qqInit() {
	qq?.on("system.online", function () {
		ctx.globalState.update("defaultQQ", qq?.uin);
		qqStatusNow = "我在线上";
		vscode.window.showInformationMessage(`QQ: ${qq?.nickname}(${qq?.uin}) 已上线`);
		vscode.window.registerTreeDataProvider("chat-friends", {
			getChildren: function (element?: number) {
				// @ts-ignore
				return [...qq?.fl.keys()];
			},
			getTreeItem: function (uid: number) {
				const item = new vscode.TreeItem(qq?.fl.get(uid)?.nickname ?? "removed");
				item.id = String(uid);
				return item;
			},
		});
		vscode.window.registerTreeDataProvider("chat-groups", {
			getChildren: function (element?: number) {
				return [...qq?.gl.keys()];
			},
			getTreeItem: function (gid: number) {
				const item = new vscode.TreeItem(qq?.gl.get(gid)?.group_name ?? "removed");
				item.id = String(gid);
				return item;
			},
		});
	});
	qq?.on("system.login.error", function (data) {
		vscode.window.showErrorMessage(data.message);
		if (data.message.includes("密码错误")) {
			ctx.globalState.update("password-" + qq?.uin, undefined);
		}
		qq = null;
	}); 
	qq?.on("system.login.slider", function (data) {
		vscode.window.showInformationMessage(`[点我](${data.url}) 完成滑动验证码并获取ticket (按F12查看网络请求以获取)`);
		inputTicket();
		// const sliderWebview = vscode.window.createWebviewPanel("slider", "收到滑动验证码", -1, {
		// 	enableScripts: true,
		// 	enableCommandUris: true
		// });
		// sliderWebview.webview.onDidReceiveMessage((ticket)=>{
		// 	console.log(ticket)
		// 	qq?.sliderLogin(String(ticket));
		// });
		// sliderWebview.webview.html = `<script>location.href="${data.url}";</script>`;
		// https.get(data.url, (res)=>{
		// 	res.setEncoding("utf-8");
		// 	let d = "";
		// 	res.on("data", chunk=>d+=chunk);
		// 	res.on("end", ()=>{
		// 		const location = new URL(data.url);
		// 		sliderWebview.webview.html = `<script>history.pushState(null, "", "${location.password+location.search}");</script>` + d + codeOfGettingSliderTicket;
		// 		sliderWebview.reveal();
		// 	});
		// });
	});
	qq?.on("system.login.device", function (data) {
		const webview = vscode.window.createWebviewPanel("device", "[QQ]需要验证设备安全性 (完成后请关闭)", -1, {
			enableScripts: true,
			enableCommandUris: true
		});
		webview.webview.html = `<script>location.href="${data.url}";</script>`;
		webview.reveal();
		webview.onDidDispose(()=>{
			qq?.login();
		});
	});
	qq?.on("system.offline", (data)=>{
		if (data.sub_type !== "network") {
			vscode.window.showWarningMessage(data.message);
		}
	});
}

// var codeOfGettingSliderTicket = `<script>
// (function () {
// 	const vscode = acquireVsCodeApi();
// 	const id = setInterval(() => {
// 		try {
// 			const ticket = capGetTicket().ticket;
// 			if (ticket) {
// 				clearInterval(id);
// 				vscode.postMessage(ticket);
// 			}
// 		} catch {}
// 	}, 2000);
// })();
// </script>`;

/**
 * create the QQ instance
 * @param uin 
 */
function createQQ(uin: number) {
	qq = oicq.createClient(uin, {
		ignore_self: false,
		platform: 5,
		data_dir: ctx.globalStoragePath,
		reconn_interval: 3,
	});
	qqInit();
	inputPassword();
}

function inputAccount(uin?: number) {
	if (uin) {
		return createQQ(uin);
	}
	vscode.window.showInputBox({
		prompt: "请输入你的QQ账号",
	}).then((uin)=>{
		if (!uin) {
			return;
		}
		try {
			createQQ(Number(uin));
		} catch {
			inputAccount();
		}
	});
}

/**
 * input password of qq account
 */
function inputPassword() {

	// find passward from globalState
	const password = ctx.globalState.get("password-" + qq?.uin);
	if (password) {
		return qq?.login(String(password));
	}

	// input
	vscode.window.showInputBox({
		prompt: `输入QQ号 ${qq?.uin} 的密码`,
		password: true
	}).then((pass)=>{
		if (!pass) {
			return inputPassword();
		}
		const password = crypto.createHash("md5").update(pass).digest("hex");
		ctx.globalState.update("password-" + qq?.uin, password);
		qq?.login(password);
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
				qq?.sliderLogin(ticket);
			}
		});
}
