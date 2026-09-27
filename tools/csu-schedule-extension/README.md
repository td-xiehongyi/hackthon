# CSU 课表抓取助手（本地未打包扩展）

这是一个可在 Chrome / Edge 中“加载已解压的扩展程序”的 Manifest V3 插件。它解决 CSU 教务页面没有“下载课表”按钮的问题：学生在已经登录的课表页主动点击一次，插件读取页面上已经显示的课表 DOM 或页面内课表 JSON，立即下载一个 WakeUp 兼容的 UTF-8 CSV，同时把标准化结果交给本机课表页面的导入预览。

## 安装

1. 先运行本项目：

   ```bash
   npm run dev
   ```

2. 在 Chrome/Edge 打开 `chrome://extensions` 或 `edge://extensions`，开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，选择本目录 `tools/csu-schedule-extension`。
4. 打开 `http://127.0.0.1:5176/#teaching`（一键启动；默认开发服务为 5173），进入“课表管理 → 从 CSU 教务系统导入”。

如果之前已加载旧版扩展，请在扩展管理页点击本扩展的“重新加载”，接受新增的“管理下载内容”权限，然后刷新已经打开的 CSU 课表标签页。否则旧内容脚本仍会显示原按钮。

不要在文件管理器里双击 `popup.html`，也不要把它作为普通网页打开。该文件只是扩展源文件；脱离 Chrome/Edge 的扩展上下文时没有后台 Service Worker，页面会明确提示“请从工具栏打开扩展”，也不会尝试抓取。正确方式是从扩展管理页加载本目录后，点击浏览器工具栏中的扩展图标。

扩展目前允许的页面只有：

- `csujwc.its.csu.edu.cn` 的旧版教务课表页面；
- 本项目的 `127.0.0.1:5173`、`127.0.0.1:5174`、`localhost:5173` 、`localhost:5174`、`127.0.0.1:5176` 或 `localhost:5176` 页面。

请先在 `https://ca.csu.edu.cn/` 或网上办事大厅完成官方登录，再按学校页面跳转进入旧版教务课表页。CA/ehall 入口不在扩展匹配范围内，扩展也不会读取登录页、密码、验证码或 Cookie。

## 使用

1. 切换到已登录的 CSU 教务课表页（通常是“我的课表”）。
2. 点击浏览器工具栏中的扩展图标，插件会立即自动抓取并下载，无需再点第二个按钮；也可以点击页面右下角“一键下载课表 CSV”。浏览器会下载类似 `CSU课表-20260926-173953Z.csv` 的文件，可直接导入 WakeUp 或本项目。弹窗中的“重新下载”用于页面尚未加载完成时重试。
3. 如果同时打开了项目的“从 CSU 教务系统导入”弹窗，插件还会把同一批课程送入已有的“课表导入预览”，检查通过后再选择“追加”或“替换”并确认保存；下载失败不会阻止预览导入。
4. 如果项目当时没有打开，插件会在扩展本地存储中暂存最近一次标准化结果；重新打开项目后会自动重放。可在扩展弹窗点击“清除扩展缓存”。

没有识别到课程时，请先进入真正的旧版课表页面，而不是 CA/ehall 登录页、门户首页或课程查询列表。旧版 `table#kbtable` / `.kbcontent` 网格直接复制时可能没有可识别表头，请在该旧课表页点击插件抓取；插件也支持常见表格列、嵌入 JSON，以及 `课程名称/周次/节次/上课地点` 这类文本字段。

### 没有安装扩展时：用 DevTools Console 点击提取

如果浏览器暂时不能加载扩展，也可以在已登录的旧版教务课表页使用随附的
[`console-extractor.js`](console-extractor.js) 兜底脚本：

1. 打开 `csujwc.its.csu.edu.cn` 的“我的课表”，确认课表已经显示；不要在 CA 登录页或门户首页运行。
2. 按 `F12`（或右键“检查”）打开 Chrome/Edge DevTools，切到 **Console**。
3. 用文本编辑器打开 `console-extractor.js`，复制**全部内容**粘贴到 Console，并按 Enter。若浏览器显示“允许粘贴”安全提示，请先手动输入 `allow pasting` 后再粘贴；不要执行来源不明的代码。
4. 页面右下角出现“CSU 课表 Console 提取器”后，点击“提取并下载课表 CSV”。下载的文件可以直接导入 WakeUp 或本项目。

脚本也暴露了一个仅存在于当前页面内存中的调试对象。需要再次提取时可在 Console 执行
`window.__CSU_SCHEDULE_CONSOLE_EXTRACTOR__.capture()`；查看最近一次结果可执行
`window.__CSU_SCHEDULE_CONSOLE_EXTRACTOR__.lastPayload`。重复粘贴脚本会先移除旧按钮，不会叠加多个面板。

Console 方式与扩展使用同一套旧版网格、常见表格和嵌入 JSON 识别规则；它只读取当前文档及已经存在的同源 frame 的 DOM，点击后在本地生成 CSV，不发起网络请求，不读取密码、Cookie、localStorage 或认证令牌，也不会把数据上传到服务器。关闭或刷新页面即可清除脚本及其内存数据。

如果状态超过 10 秒没有变化，请到 `chrome://extensions` / `edge://extensions` 点击扩展的“重新加载”，确认 Service Worker 没有报错，再刷新课表页后重试。弹窗和课表页按钮都会在后台无响应时结束等待并给出下一步提示，不会无限转圈。

## 隐私与安全边界

- 插件只在用户点击抓取后读取已渲染页面；不自动登录、不代填账号密码、不读取密码输入框、Cookie、localStorage 或认证令牌，也不绕过验证码。
- 原始 HTML 不上传网络。传给本项目的只有课程名称、教师、星期、节次、周次、单双周和地点等标准化字段。
- 一键下载只生成八列 WakeUp 兼容 CSV（课程名称、星期、起止节次、老师、地点、周数、兴趣标签），文件在当前浏览器本地生成，不会上传第三方。
- 插件只保留最近一次抓取结果在浏览器扩展存储中；项目仍会显示统一的导入预览，用户确认前不会修改个人课表。
- 教务系统返回的备注/实践说明若没有完整星期和节次，不会被伪造成一门有时间的课程。

## 参考实现（仅借鉴格式/交互，不复制登录代码）

- [csuhan/csugo](https://github.com/csuhan/csugo)（Go）：提供旧版 `table#kbtable` / `.kbcontent` 网格结构的公开参考。
- [SuInk/csu-import](https://github.com/SuInk/csu-import)（MIT）：记录 CSU `getKbxx.do` JSON 的 `title` 多行字段、`xq` 和紧凑节次格式。仓库中的自动登录代码没有被采用。
- [youfond/offline-timetable](https://github.com/youfond/offline-timetable)：展示“解析 → 预览 → 用户确认”和把无时间备注单独保留的流程；本扩展不采用其 Cookie/登录模式。
- [lan-kehan/fudan-course-table-export](https://github.com/lan-kehan/fudan-course-table-export)：用户自己在已登录页面取得数据、再本地转换的安全交互思路；它没有声明许可证，因此只作产品流程参考。

以上项目的域名、接口和页面结构可能已经过时；本插件不会后台请求这些接口。课表字段解析最终仍由本项目的 `src/features/teaching/caImport.ts` 统一校验。
