# clash-verge-rev-override

适配 [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) 的**全局覆写配置**：防 DNS 泄露 + 国内外分流。

配置文件：[`clash-verge-rev-override.yaml`](./clash-verge-rev-override.yaml)（Clash Verge Rev）；FlClash 请用 [`flclash-override.js`](./flclash-override.js)。

> 这是 **Merge（全局扩展配置）**，不是订阅链接。它会在每次订阅更新后自动重新应用，不需要手动改订阅。

## 功能

- **DNS 防泄露**：国内域名用国内 DoH 直查，其余域名通过代理节点查询（`#🛰 自选节点`），运营商看不到你的 DNS 请求。
- **Fake-IP**：`198.18.0.0/16`，并为局域网、NTP、系统联网检测、Apple 更新等域名保留真实 IP。
- **域名嗅探**：从 TLS SNI / HTTP Host 还原真实域名，按 IP 直连的流量也能命中域名规则。
- **全局覆写**：整体替换订阅自带的 `proxy-groups` 和 `rules`，节点通过 `include-all` 自动吸收，不写死任何节点名。
- **规则集**：使用 MetaCubeX 的 `mrs` 规则集，覆盖广告、AI、YouTube、Netflix、TikTok、Telegram、国内域名/IP、私有地址。

## 使用前提（重要）

Clash Verge Rev 的「应用设置」优先级高于 Merge，以下两项不关掉，配置会被丢弃并弹出橙色提示：

1. **关闭 DNS 覆写**
   `设置 → Clash 设置 → DNS 覆写`，关闭当前订阅的开关。
   - v2.5.5 起该开关按订阅独立保存，换订阅后要再确认一次。
2. **关闭 IPv6**
   `设置 → Clash 设置 → IPv6`，选择关闭。
   - 顶层 `ipv6` 始终由应用接管，写在 Merge 里无效，所以本配置不写它。

## 使用方法

1. 打开 Clash Verge Rev → **订阅**页。
2. 点击右上角 **全局扩展配置**（旧版叫「全局扩展覆写配置」）。
3. 切到 **Merge** 标签，粘贴 `clash-verge-rev-override.yaml` 的全部内容。
4. 保存，等待内核重载。

## FlClash（Android）

FlClash **不读取** Clash Verge 的 Merge YAML，它的覆写是 JavaScript 脚本（`main(config)` 返回改好的 config）。所以 FlClash 请用 [`flclash-override.js`](./flclash-override.js)，内容与上面的 YAML 等价：

1. 工具 → 进阶配置 → **脚本** → 新建，粘贴脚本内容并保存。
2. 长按（或右键）订阅 → **扩展** → 选中这个脚本，按右上角提示确认应用。
3. 打开 TUN 模式。

注意：

- 0.9.4 起 FlClash 的 DNS 覆写改为按字段对每份配置生效。请清空「工具 → 进阶配置 → DNS」里填过的字段，尤其 `proxy-server-nameserver` 留空会覆盖脚本里的同名值并导致内核报错。
- 脚本会整体替换 `dns`、`sniffer`、`rule-providers`、`proxy-groups`、`rules`，并设置顶层 `ipv6: false`；节点仍由 `include-all` 自动吸收。
- FlClash 版脚本只做了静态检查，未做真机验证；异常时请查看连接页的规则命中。

## 验证

订阅页 → **查看运行时订阅**，确认：

```yaml
dns:
  nameserver:
    - "https://8.8.8.8/dns-query#🛰 自选节点"
    - "https://1.1.1.1/dns-query#🛰 自选节点"
```

以及 `dns.fake-ip-filter` 包含完整列表、`proxy-groups` 里有 `🛰 自选节点`。如果 `nameserver` 不是上面两项，说明「DNS 覆写」还开着。

## Windows 一键检查

仓库附带 [`test-windows.ps1`](./test-windows.ps1)，只读检查，不改任何配置。先在 Verge 中开启 **TUN 模式**，然后：

```powershell
powershell -ExecutionPolicy Bypass -File .\test-windows.ps1
```

检查项：

- `google.com` 是否解析为 `198.18.x.x`（fake-ip / DNS 劫持生效）
- `baidu.com`、`time.windows.com` 是否返回真实 IP（fake-ip-filter 生效）
- 代理出口与国内直连出口是否不同（分流生效）
- 是否存在 IPv6 出口
- 规则集能否正常下载

`国内出口` 应显示你本地运营商的出口 IP（如 `112.x.x.x`），与 `代理出口` 不同即分流生效。手工查 IP 请用 `curl.exe`——PowerShell 里的 `curl` 是 `Invoke-WebRequest` 的别名，返回的是解析后的对象而非原始响应。

DNS 泄露和 WebRTC 仍需手动打开 ipleak.net、dnsleaktest.com、browserleaks.com/webrtc 确认。

## 策略组

| 组名 | 类型 | 作用 |
| --- | --- | --- |
| `⚡ 自动选择` | url-test | 全部节点自动测速，默认出口 |
| `🛰 自选节点` | select | 手动选节点，也是 `MATCH` 的兜底 |
| `🤖 AI 分流` | select | AI 类域名（OpenAI、Claude 等） |
| `🎬 流媒体` | select | YouTube / Netflix / TikTok |
| `📲 电报` | select | Telegram 域名与 IP |
| `🛑 广告` | select | 广告域名，默认 `REJECT` |

组名刻意避开了机场常见的 `🚀 节点选择` / `♻️ 自动选择`，避免与订阅自带分组重名。

## 分流规则

按顺序匹配：

1. 私有域名 / 私有 IP → `DIRECT`
2. 广告 → `🛑 广告`
3. AI → `🤖 AI 分流`
4. YouTube / Netflix / TikTok → `🎬 流媒体`
5. Telegram 域名 / IP → `📲 电报`
6. 国内域名 / IP → `DIRECT`
7. 其余 → `🛰 自选节点`

## 常见问题

**弹窗：扩展配置或脚本写入了由应用设置接管的字段 dns.xxx，这些值已被丢弃**

说明「DNS 覆写」还开着。按上面的「使用前提」关闭它，再重新保存 Merge。

**订阅自带的策略组 / 规则不见了**

这是全局覆写的预期行为：`proxy-groups` 和 `rules` 被整体替换。若机场提供「流媒体解锁」等专用组，需要自己补进 `proxy-groups`。

**换机场后组里没有节点**

`include-all` 会吸收订阅的 `proxies` 和 `proxy-providers`。如果订阅只有远程 provider 且尚未下载完成，等内核拉取后即可。

**某些应用联网异常**

可尝试把 `sniffer.override-destination` 改为 `false` 后重载。

**在 browserleaks 测 WebRTC，Remote IP 显示的是本地 IP？**

`browserleaks.com` 和 `ipip.net` 都在上游 `cn` 规则集里，会命中 `cn_domain → DIRECT`，所以页面本身走直连；而 WebRTC 的 STUN 请求发往国外服务器，走代理。两行 IP 不一致是正常的，关键看 Local IP 是否为 `-`。要测代理下的 WebRTC，换用不在 cn 列表的站点。

## 说明

- 规则集地址来自 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)。
- 设计参考了 [qichiyuhub/rule](https://github.com/qichiyuhub/rule) 与 [n0de-sudo/Perfect-Rules](https://github.com/n0de-sudo/Perfect-Rules)。
- Clash Verge Rev 的 YAML 配置与 Windows 检查脚本已真机验证：fake-ip、fake-ip-filter、国内外分流、IPv6 屏蔽、规则集下载均通过；DNS 与 WebRTC 请以网站实测结果为准。
- FlClash 的 JS 脚本仅为 YAML 的等价移植，未做真机验证。
