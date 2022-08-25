import * as fs from 'fs';
import * as path from 'path';
import * as oicq from 'oicq';
import * as vscode from 'vscode';
import { ctx, client, NOOP } from "./global";

interface Config extends oicq.Config {
    account?: number,
    password?: string,
    show_me_add_group_request?: boolean,
    theme?: string,
    theme_css?: string,
    theme_js?: string,
}

const optimized: Config = {
    account: 0,
    password: "",
    platform: 5,
    show_me_add_group_request: false,
    theme: "default",
    theme_css: "",
    theme_js: "",
};

let config: Config | undefined;

function getConfigFilePath() {
    return path.join(ctx.globalStoragePath, "config.json");
}

export function getConfig(): Config {
    if (!config) {
        try {
            config = JSON.parse(fs.readFileSync(getConfigFilePath(), { encoding: "utf-8" }));
        } catch {
            fs.writeFile(getConfigFilePath(), JSON.stringify(optimized, null, 2), NOOP);
            config = { ...optimized };
        }
    }
    //@ts-ignore
    return config;
}

export function setConfig(obj: Config) {
    Object.assign(getConfig(), obj);
    fs.writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), NOOP);
}

export function genClientConfig() {
    const clientConfig: oicq.Config = {
        log_level: "off",
        // kickoff: false,
        ignore_self: false,
        // brief: true,
        reconn_interval: 0,
        data_dir: ctx.globalStoragePath,
    };
    return Object.assign(clientConfig, getConfig());
}

let watcherCreatedFlag = false;
export function openConfigFile() {
    getConfig();
    const uri = vscode.Uri.file(getConfigFilePath());
    vscode.window.showTextDocument(uri);
    if (!watcherCreatedFlag) {
        watcherCreatedFlag = true;
        vscode.workspace.createFileSystemWatcher(getConfigFilePath(), true, false, true).onDidChange(async () => {
            try {
                config = JSON.parse(await fs.promises.readFile(getConfigFilePath(), { encoding: "utf-8" }));
            } catch {
                vscode.window.showErrorMessage("配置文件中有错误，请检查。");
            }
        });
    }
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
