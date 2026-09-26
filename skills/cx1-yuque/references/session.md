# 显式 session 导入

会话只用于 `https://www.yuque.com`，不支持内网 IAM。默认缓存 `~/.config/cx1-yuque/session.json`；用 `YUQUE_SESSION_FILE` 指定其他位置。缓存目录必须 0700、文件 0600，拒绝符号链接文件。只保存 `_yuque_session`、`yuque_ctoken` 和账号/时间元数据。

## 普通终端获取方式

1. 在 Chrome 登录公网语雀，打开 DevTools → Network，刷新页面；找到 `/api/mine` 或其他已成功的本站 `/api/` 请求。
2. 从 Request Headers 复制 **Cookie header 的值**。不要使用 `document.cookie`，因为它读不到 HttpOnly session；不要复制完整 HAR/curl 到聊天或仓库。
3. macOS 可以从剪贴板导入（`yq` 为指向 `scripts/yuque.sh` 的 shell 函数）：

```bash
pbpaste | yq session import --account EXPECTED_LOGIN
printf '' | pbcopy
yq session status
```

也可从权限为 0600 的临时文件重定向 stdin。不要把 Cookie 放在命令参数、shell 历史或环境变量中。使用后删除临时凭据副本。这里只接受一行 Cookie，不接受 curl/Netscape/Set-Cookie 格式。

`--account` 必填，必须由用户已知账号或授权浏览器身份确定。导入会在线请求 `/api/mine`；账号不符、未登录、非 JSON 或缺 CSRF 时拒绝保存，已有缓存不被替换。知道浏览器 Cookie expires 时可加 `--expires ISO_TIME`；不知道就省略，不推测签发时间或有效期。

## 代理辅助获取

如果当前浏览器插件允许读取 Chrome Cookie，可通过其支持的 CDP `Network.getCookies`（URL 限定 `https://www.yuque.com/`）取得两项 Cookie。不要将结果打印到工具输出；在浏览器运行时内组合 header，再用下面的一次性接收入口导入。浏览器插件的虚拟剪贴板不一定与 pbpaste 相通，不依赖它传递凭据。只在用户已授权语雀登录会话使用的范围内执行；不要扫描其他站点或读取 Chrome 数据库/钥匙串。

浏览器工具不可用时，明确让用户完成上面的复制与导入步骤。本技能所有远端操作都需要有效 session；不能改用 Token。

## 失效处理

- `session status` 在线校验，只输出账号、导入时间及可选到期时间；不输出 Cookie。
- 401/403/419 可能是登录、CSRF 或权限问题；先 status，再区分目标对象权限，不能一律认定 session 到期。
- 302、登录 HTML、账号变化均停止。需要时重新登录 Chrome，再显式导入。
- `session forget` 删除本地缓存，不注销浏览器，也不撤销服务端会话。
- 没有定时续期、后台保活、自动读取浏览器或自动重新登录。每个命令的 session 校验不被宣传为续期。

## 一次性本机接收（代理辅助）

```bash
yq session receive --account EXPECTED_LOGIN
```

命令显式启动 127.0.0.1 随机端口，stderr 输出 receiveUrl 和 120 秒期限。URL 包含一次性随机 nonce；成功或失败处理一次 POST 后关闭。只允许 www.yuque.com Origin（或无 Origin 的本地客户端），不监听局域网。

浏览器插件在运行时内部读取并筛选两项 Cookie，然后通过其支持的 CDP Runtime.evaluate 同源开发工具通道执行 `fetch(receiveUrl, {method:"POST",headers:{"Content-Type":"text/plain"},body:cookieHeader})`。用运行时变量构造表达式，不把 Cookie 值插入模型消息或打印到输出。接收端验证实际 /api/mine 后原子保存。只回报 HTTP 状态和账号元数据。处理完成释放运行时中的 Cookie 引用。

若 Chrome 阻止本机网络请求，停止该路径并使用手工 stdin 导入；不要为此关闭浏览器安全保护。超时后可重新显式启动，旧 URL 不复用。
