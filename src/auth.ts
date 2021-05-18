/**
 * @fileoverview
 * 用户验证，把账户密码保存到 VSCode 内并跨设备传输
 */

import * as vscode from 'vscode';
import { AuthenticationProvider, AuthenticationProviderAuthenticationSessionsChangeEvent, AuthenticationSession, EventEmitter } from 'vscode';

class AccountManager implements AuthenticationProvider {

    private static readonly session: AuthenticationSession = {
        id: '',
        accessToken: '',
        scopes: [],
        // 这个字段会被覆盖后提供给其他接口，应该可以实现多账户
        account: {
            id: '',
            label: ''
        }
    };

    _onDidChangeSessions =
        new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
    readonly onDidChangeSessions = this._onDidChangeSessions.event;

    async removeSession(_sessionId: string): Promise<void> {

    }

    // VSCode 的验证可以指定一个授权范围，不过这里只是 QQ 的账户所以应该不用特别限制
    async createSession(_scopes: string[]): Promise<AuthenticationSession> {
        throw new Error();
    }

    getSessions(_scopes?: string[]): Promise<ReadonlyArray<AuthenticationSession>> {
        return Promise.resolve([]);
    }
}

vscode.authentication.registerAuthenticationProvider('vscode-qq-auth-provider', 'QQ', new AccountManager());
