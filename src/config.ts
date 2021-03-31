import * as fs from 'fs';
import * as path from 'path';
import * as oicq from 'oicq';
import * as vscode from 'vscode';
import { ctx, client, NOOP } from "./global";

interface Config extends oicq.ConfBot {
    account: number;
    password: string;
    show_me_add_group_request: boolean,
}

const optimized: Config = {
    account: 0,
    password: "",
    platform: 5,
    show_me_add_group_request: false,
    remote_ip: "",
    remote_port: 0,
};

function getConfigFilePath() {
    return path.join(ctx.globalStoragePath, "config.json");
}

function readConfig(): Config {
    try {
        return JSON.parse(fs.readFileSync(getConfigFilePath(), { encoding: "utf-8" }));
    } catch {
        fs.writeFileSync(getConfigFilePath(), JSON.stringify(optimized, null, 2));
        return optimized;
    }
}

export function genConfig() {
    const config: oicq.ConfBot = {
        log_level: "off",
        kickoff: false,
        ignore_self: false,
        brief: true,
        reconn_interval: 0,
        data_dir: ctx.globalStoragePath,
    };
    return Object.assign(readConfig(), config);
}

export function writeAccount(account: number, password: string) {
    const config = readConfig();
    config.account = account;
    config.password = password;
    fs.writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), NOOP);
}

export function openConfigFile() {
    readConfig();
    const uri = vscode.Uri.file(getConfigFilePath());
    vscode.window.showTextDocument(uri);
}

export function deleteToken() {
    if (client) {
        fs.unlink(path.join(client.dir, "token"), NOOP);
        fs.unlink(path.join(client.dir, "t106"), NOOP);
    }
}

export function writePinned(pinned: string[]) {
    fs.writeFile(path.join(client.dir, "pinned"), pinned.join("\n"), NOOP);
}

export async function readPinned() {
    try {
        const pinned = await fs.promises.readFile(path.join(client.dir, "pinned"), { encoding: "utf-8" });
        return String(pinned).split("\n");
    } catch {
        return [];
    }
}
