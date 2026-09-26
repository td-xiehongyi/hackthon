# CSU 课表抓取助手（本地未打包扩展）

这是一个可在 Chrome / Edge 中“加载已解压的扩展程序”的 Manifest V3 插件。它解决 CSU 教务页面没有“下载课表”按钮的问题：学生在已经登录的课表页主动点击抓取，插件读取页面上已经显示的课表 DOM 或页面内课表 JSON，标准化后交给本机课表页面的导入预览。

## 安装

1. 先运行本项目：

   ```bash
   npm run dev
   ```

2. 在 Chrome/Edge 打开 `chrome://extensions` 或 `edge://extensions`，开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，选择本目录 `tools/csu-schedule-extension`。
4. 打开 `http://127.0.0.1:5173/#teaching`，进入“课表管理 → 从 CSU 教务系统导入”。

扩展目前允许的页面只有：

- `csujwc.its.csu.edu.cn` 的旧版教务课表页面；
- 本项目的 `127.0.0.1:5173`、`127.0.0.1:5174`、`localhost:5173` 或 `localhost:5174` 页面。

请先在 `https://ca.csu.edu.cn/` 或网上办事大厅完成官方登录，再按学校页面跳转进入旧版教务课表页。CA/ehall 入口不在扩展匹配范围内，扩展也不会读取登录页、密码、验证码或 Cookie。

## 使用

1. 在项目导入弹窗点击“等待插件数据”。
2. 切换到已登录的 CSU 教务课表页（通常是“我的课表”），点击页面右下角“抓取当前课表”；也可以点击浏览器工具栏中的扩展图标，再点“抓取当前 CSU 课表”。
3. 切回项目。插件会把课程送入已有的“课表导入预览”，检查通过后再选择“追加”或“替换”并确认保存。
4. 如果项目当时没有打开，插件会在扩展本地存储中暂存最近一次标准化结果；重新打开项目后会自动重放。可在扩展弹窗点击“清除扩展缓存”。

没有识别到课程时，请先进入真正的旧版课表页面，而不是 CA/ehall 登录页、门户首页或课程查询列表。旧版 `table#kbtable` / `.kbcontent` 网格直接复制时可能没有可识别表头，请在该旧课表页点击插件抓取；插件也支持常见表格列、嵌入 JSON，以及 `课程名称/周次/节次/上课地点` 这类文本字段。

## 隐私与安全边界

- 插件只在用户点击抓取后读取已渲染页面；不自动登录、不代填账号密码、不读取密码输入框、Cookie、localStorage 或认证令牌，也不绕过验证码。
- 原始 HTML 不上传网络。传给本项目的只有课程名称、教师、星期、节次、周次、单双周和地点等标准化字段。
- 插件只保留最近一次抓取结果在浏览器扩展存储中；项目仍会显示统一的导入预览，用户确认前不会修改个人课表。
- 教务系统返回的备注/实践说明若没有完整星期和节次，不会被伪造成一门有时间的课程。

## 参考实现（仅借鉴格式/交互，不复制登录代码）

- [csuhan/csugo](https://github.com/csuhan/csugo)（Go）：提供旧版 `table#kbtable` / `.kbcontent` 网格结构的公开参考。
- [SuInk/csu-import](https://github.com/SuInk/csu-import)（MIT）：记录 CSU `getKbxx.do` JSON 的 `title` 多行字段、`xq` 和紧凑节次格式。仓库中的自动登录代码没有被采用。
- [youfond/offline-timetable](https://github.com/youfond/offline-timetable)：展示“解析 → 预览 → 用户确认”和把无时间备注单独保留的流程；本扩展不采用其 Cookie/登录模式。
- [lan-kehan/fudan-course-table-export](https://github.com/lan-kehan/fudan-course-table-export)：用户自己在已登录页面取得数据、再本地转换的安全交互思路；它没有声明许可证，因此只作产品流程参考。

以上项目的域名、接口和页面结构可能已经过时；本插件不会后台请求这些接口。课表字段解析最终仍由本项目的 `src/features/teaching/caImport.ts` 统一校验。
