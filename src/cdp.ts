import * as child_process from "child_process";
import * as os from "os";
import * as WebSocket from "ws";

let server: WebSocket.Server;
let port = 0;

const params = [
    "--new-window",
    "--remote-debugging-port="
];

function startup() {
    server = new WebSocket.Server();
    //@ts-ignore
    port = server.address().port;
}

function openChrome(url: string) {
    let cmd = `chrome ${url} `;
    if (os.platform().includes("win")) {
        cmd = "cmd /c start " + cmd;
    }
    cmd += params.join(" ") + port;
    child_process.execSync(cmd);
}
