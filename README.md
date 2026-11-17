# 时刻日志 · 网页测试版

iPhone App「时刻日志（HourLog）」的网页版，用于在手机上提前试用。纯静态页面（HTML/CSS/JS，无构建步骤、无第三方依赖、无外部请求）。

## 功能
- 打字或语音记录，自动带上保存时刻；空内容无法保存
- 按天时间线（0–23 点），空的小时可点按补记；今天自动滚动到当前小时
- 修改文字/时间，删除前确认
- 中英文界面，跟随浏览器语言
- 可“添加到主屏幕”，全屏像 App 一样打开

## 与 iPhone App 的区别
- 没有每小时提醒（请用「提醒事项」或闹钟）
- 语音由浏览器提供，可能把声音发到 Apple/Google 服务器；不支持时请用手机键盘上的麦克风听写
- 数据只存在当前浏览器（localStorage），清除网站数据会丢失；iOS 约 7 天不打开且未添加到主屏幕可能被清除

## 本地运行
```
cd web
python3 -m http.server 8000
```
打开 http://localhost:8000/ 。（语音识别需要 https 或 localhost。）

## 测试
```
cd web
node --test
```
覆盖：按小时分组与日期边界、文本校验、本地存储增删改（可注入后端、写入失败降级）、中英文词条一致性。

## 部署（GitHub Pages）
仓库只放 `web/` 里的内容。所有路径均为相对路径，可部署在子路径（如 `/hourlog-web/`）下。

## 文件
- `index.html` `styles.css` `manifest.webmanifest` `icons/`
- `js/logic.js` 分组与日期逻辑；`js/storage.js` 存储；`js/i18n.js` 多语言；`js/speech.js` 语音；`js/app.js` 界面
- `tests/` Node 测试
