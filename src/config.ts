import * as fs from 'fs';
import * as path from 'path';
import * as oicq from 'oicq';
import * as vscode from 'vscode';
import { ctx } from "./global";

interface Config extends oicq.ConfBot {
    account: number;
    password: string;
    receive_group_request: boolean,
}

const optimized: Config = {
    account: 0,
    password: "",
    platform: 5,
    receive_group_request: false,
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

export function writeAccount(account: number) {
    const config = readConfig();
    config.account = account;
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2));
}
export function writePassword(password: string) {
    const config = readConfig();
    config.password = password;
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2));
}

export function openConfigFile() {
    readConfig();
    const uri = vscode.Uri.file(getConfigFilePath());
    vscode.window.showTextDocument(uri);
}
