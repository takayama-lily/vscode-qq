import * as child_process from "child_process";
import * as EventEmitter from "events";
import * as http from "http";
import * as os from "os";
import * as WebSocket from "ws";
import * as getPort from "get-port";

const params = [
    "--remote-debugging-port="
];

export const NO_CHROME_ERROR = Symbol("no chrome");
export const TIMEOUT_ERROR = Symbol("failed too many time");
export const UNFINISHED_ERROR = Symbol("chrome closed but no ticket");

export class Cdp extends EventEmitter {
    private port = 0;
    private url = "";
    private webSocketDebuggerUrl = "";
    private ticket = "";

    private async openChrome(url: string) {
        this.port = await getPort();
        let cmd = "";
        if (os.platform().includes("win")) {
            cmd = "cmd /c start chrome.exe";
        } else {
            cmd = "chrome";
        }
        cmd += ` "${url}" `;
        cmd += params.join(" ") + this.port;
        this.url = url;
        child_process.execSync(cmd);
    }

    private getWebSocketDebuggerUrl() {
        http.get("http://localhost:" + this.port + "/json/list", (res) => {
            res.setEncoding("utf-8");
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    const obj = JSON.parse(data);
                    for (let o of obj) {
                        if (o.url === this.url) {
                            this.webSocketDebuggerUrl = o.webSocketDebuggerUrl;
                        }
                    }
                } catch { }
            });
        }).on("error", () => { });
    }

    private _getTicket() {
        const ws = new WebSocket(this.webSocketDebuggerUrl);
        ws.on("open", () => {
            ws.send(JSON.stringify({
                id: 1,
                method: "Network.enable"
            }));
        });
        ws.on("error", () => {});
        ws.on("close", () => {
            if (!this.ticket) {
                this.emit("error", UNFINISHED_ERROR);
            }
        });
        ws.on("message", (data) => {
            try {
                const obj = JSON.parse(String(data));
                if (obj.method === "Network.responseReceived" && obj.params.type === "XHR" && obj.params.response.url === "https://t.captcha.qq.com/cap_union_new_verify") {
                    ws.send(JSON.stringify({
                        id: 2,
                        method: "Network.getResponseBody",
                        params: {
                            requestId: obj.params.requestId
                        },
                    }));
                } else if (obj.id === 2) {
                    const body = JSON.parse(obj.result.body);
                    this.ticket = body.ticket;
                    if (this.ticket) {
                        this.emit("ticket", this.ticket);
                    }
                    ws.close();
                }
            } catch { }
        });
    }

    public async getTicket(url: string) {
        try {
            await this.openChrome(url);
        } catch {
            this.emit("error", NO_CHROME_ERROR);
            return;
        }
        this.getWebSocketDebuggerUrl();
        let times = 1;
        const id = setInterval(() => {
            ++times;
            if (this.webSocketDebuggerUrl) {
                clearInterval(id);
                this._getTicket();
            } else {
                if (times >= 10) {
                    clearInterval(id);
                    this.emit("error", TIMEOUT_ERROR);
                } else {
                    this.getWebSocketDebuggerUrl();
                }
            }
        }, 1000);
    }
}
