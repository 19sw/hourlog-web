# 时刻日志 · 网页测试版

iPhone App「时刻日志（HourLog）」的网页版，用于在手机上提前试用。纯静态页面（HTML/CSS/JS，无构建步骤、无第三方依赖、无外部请求）。

## 功能
- 打字或语音记录，自动带上保存时刻；空内容无法保存
- 按天时间线（0–23 点），空的小时可点按补记；今天自动滚动到当前小时
- 修改文字/时间，删除前确认
- 中英文界面，跟随浏览器语言
- 可“添加到主屏幕”，全屏像 App 一样打开
- 「学习」标签页：选课程和目标 → 摸底 → 个人路线 → 分步学习（讲解、可以问的问题、动手任务、思考题、小测）→ 进度和调整；完成摸底和每掌握一节会自动记到时间线。示范课程「视频剪辑基础」

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
覆盖：按小时分组与日期边界、文本校验、本地存储增删改（可注入后端、写入失败降级）、中英文词条一致性；学习路线规则、周边界（含夏令时时区）、卡点与调整、学习进度存储（版本化、损坏与写入失败、多个标签页同时写入）、课程包校验与示范课程内容完整性。

浏览器端到端流程（需要 Chrome，不包含在 `node --test` 里）：`node tests/e2e/run.mjs`，说明见 `tests/e2e/README.md`。

## 部署（GitHub Pages）
仓库只放 `web/` 里的内容。所有路径均为相对路径，可部署在子路径（如 `/hourlog-web/`）下。

## 文件
- `index.html` `styles.css` `manifest.webmanifest` `icons/`
- `js/logic.js` 分组与日期逻辑；`js/storage.js` 存储；`js/i18n.js` 多语言；`js/speech.js` 语音；`js/app.js` 界面
- `js/learn-logic.js` 学习闭环纯逻辑；`js/learn-store.js` 学习进度存储（独立键 `hourlog.learning`）；`js/learn.js` 学习界面
- `courses/` 课程包（格式见 `courses/README.md`）
- `tests/` Node 测试
