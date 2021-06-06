# VS Code QQ Extension

**[Repository](https://github.com/takayama-lily/vscode-qq)** | **[Offline Installers](https://github.com/takayama-lily/vscode-qq/releases)** | vscode >= 1.53.0
[![discord](https://img.shields.io/static/v1?label=chat&message=discord&color=7289da&logo=discord)](https://discord.gg/gKnU7BARzv)

> 该插件主要面向不方便使用官方QQ客户端的VSC用户  
> `@设置` 里的 `platform` 是登录协议，1:手机 3:手表(功能不完整) 4:PC 5:pad(默认)  
> 本程序不在本地保存任何消息记录和图片。暂不支持临时会话。  
> 首次可能需要chrome浏览器完成滑动验证码 (若无chrome请根据提示手动操作)。  
> 仍然建议您尽可能使用官方QQ客户端。  

## 切换UI主题

* 当前支持两种主题 `default`(默认) 、`console`(控制台风格)  
* 可在`@设置`中加入 `"theme": "console"` 来切换  
* 欢迎为本项目贡献UI，详细翻阅 [修改/自定义UI主题](https://github.com/takayama-lily/vscode-qq/wiki/%E8%87%AA%E5%AE%9A%E4%B9%89%E8%81%8A%E5%A4%A9UI%E7%95%8C%E9%9D%A2)

## 可用命令

> Ctrl+Shift+P 打开命令面板

* QQ Explorer: Login
* QQ Explorer: 搜索好友
* QQ Explorer: 搜索群

## 其他

* [遇到当前上网环境异常](https://github.com/takayama-lily/vscode-qq/wiki/%5B%E7%A6%81%E6%AD%A2%E7%99%BB%E5%BD%95%5D%E5%BD%93%E5%89%8D%E4%B8%8A%E7%BD%91%E7%8E%AF%E5%A2%83%E5%BC%82%E5%B8%B8)
* [清除登录信息](https://github.com/takayama-lily/vscode-qq/wiki/%E6%B8%85%E9%99%A4%E7%99%BB%E5%BD%95%E4%BF%A1%E6%81%AF)
* [外网被限制无法登录的解决方法](https://github.com/takayama-lily/vscode-qq/wiki/%E6%88%91%E7%9A%84%E6%9C%BA%E5%99%A8%E6%B2%A1%E6%9C%89%E5%A4%96%E7%BD%91%E6%80%8E%E4%B9%88%E5%8A%9E)

----

![预览图](https://raw.githubusercontent.com/takayama-lily/vscode-qq/master/preview.gif)

> 使用的UI库：[https://github.com/MorFansLab/LiteWebChat_Frame](https://github.com/MorFansLab/LiteWebChat_Frame)  
> QQ协议库：[https://github.com/takayama-lily/oicq](https://github.com/takayama-lily/oicq)

----

## 自行编译此扩展

```bash
# clone此项目
npm i
npm i typescript -g
npm i vsce -g
vsce package
```
