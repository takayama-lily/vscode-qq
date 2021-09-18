# VS Code QQ Extension

[![discord](https://img.shields.io/static/v1?label=chat&message=discord&color=7289da&logo=discord)](https://discord.gg/gKnU7BARzv) | **[Repository](https://github.com/takayama-lily/vscode-qq)** | **[Offline Installers](https://github.com/takayama-lily/vscode-qq/releases)** | vscode >= 1.53.0 | 摸鱼工具

> 本程序不在本地保存任何消息记录和图片。暂不支持临时会话。  
> `@设置` 里的 `platform` 是登录协议，1:手机 3:手表(功能不完整) 4:PC 5:pad(默认)  

## 切换UI主题

* 当前支持两种主题 `default`(默认) 、`console`(控制台风格)  
* 可在`@设置`中修改 `"theme": "console"` 来切换  
* 上级玩家可以 [修改/自定义UI主题](https://github.com/takayama-lily/vscode-qq/wiki/%E8%87%AA%E5%AE%9A%E4%B9%89%E8%81%8A%E5%A4%A9UI%E7%95%8C%E9%9D%A2)

## 可用命令

> Ctrl+Shift+P 打开命令面板

* QQ Explorer: Login
* QQ Explorer: 搜索好友
* QQ Explorer: 搜索群

## 其他

* 如何清除登录信息
  1. 登录状态下点击 `@切换账号`
  2. 关闭或重启vscode即可完全清除
* [外网被限制无法登录的解决方法](https://github.com/takayama-lily/vscode-qq/wiki/%E6%88%91%E7%9A%84%E6%9C%BA%E5%99%A8%E6%B2%A1%E6%9C%89%E5%A4%96%E7%BD%91%E6%80%8E%E4%B9%88%E5%8A%9E)

----

![预览图](https://raw.githubusercontent.com/takayama-lily/vscode-qq/master/preview.gif)

> 使用的UI库：[https://github.com/MorFansLab/LiteWebChat_Frame](https://github.com/MorFansLab/LiteWebChat_Frame)  
> QQ协议库：[https://github.com/takayama-lily/oicq](https://github.com/takayama-lily/oicq)

----

## 自行编译此扩展

```bash
# Node.js版本需高于12.16
# clone此项目
> npm i
> npm i typescript -g
> npm i vsce -g
> vsce package
```
