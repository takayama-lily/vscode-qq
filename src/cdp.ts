import * as child_process from "child_process";
import * as EventEmitter from "events";
import * as http from "http";
import * as os from "os";
import * as WebSocket from "ws";
import * as getPort from "get-port";

const params = [
    "--new-window",
    "--remote-debugging-port="
];

export class Cdp extends EventEmitter {
    private port = 0;
    private webSocketDebuggerUrl = "";

    private async openChrome(url: string) {
        this.port = await getPort();
        let cmd = "";
        if (os.platform().includes("win")) {
            cmd = "cmd /c start chrome.exe";
        } else {
            cmd = "chrome";
        }
        cmd += ` ${url} `;
        cmd += params.join(" ") + this.port;
        child_process.exec(cmd, () => { });
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
                        if (o.title?.includes("验证码")) {
                            this.webSocketDebuggerUrl = o.webSocketDebuggerUrl;
                        }
                    }
                } catch { }
            });
        }).on("error", () => { });
    }

    private _getTicket() {
        const ws = new WebSocket(this.webSocketDebuggerUrl);
        ws.on("message", (data) => {
            console.log(data);
            // this.emit("ticket", "");
            // ws.close();
        });
    }

    public getTicket(url: string) {
        this.openChrome(url);
        this.getWebSocketDebuggerUrl();
        let times = 1;
        const id = setInterval(() => {
            ++times;
            if (this.webSocketDebuggerUrl) {
                clearInterval(id);
                this._getTicket();
            } else {
                if (times >= 10) {
                    this.emit("error", new Error("failed too many time"));
                } else {
                    this.getWebSocketDebuggerUrl();
                }
            }
        }, 1000);
    }
}
