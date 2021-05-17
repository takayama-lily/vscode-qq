/**
 * @fileoverview
 * 用户验证，把账户密码保存到 VSCode 内并跨设备传输
 */

import * as vscode from 'vscode';
import { AuthenticationProvider, AuthenticationProviderAuthenticationSessionsChangeEvent, AuthenticationSession, EventEmitter } from 'vscode';

class AccountManager implements AuthenticationProvider {
    _onDidChangeSessions =
        new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
    readonly onDidChangeSessions = this._onDidChangeSessions.event;

    getSessions(): Promise<ReadonlyArray<AuthenticationSession>> {
        return Promise.resolve([]);
    }

    async removeSession(): Promise<void> {

    }

    async createSession(): Promise<AuthenticationSession> {
        throw new Error();
    }
}

vscode.authentication.registerAuthenticationProvider('vscode-qq-auth-provider', 'QQ', new AccountManager());
