# GitHub 参考与许可证

课表导入和日历导出优先采用公开、可审计的数据格式；本项目没有复制任何需要自动登录、读取 Cookie/密码或绕过验证码的代码。下面记录本次实现实际参考过的仓库，方便后续维护者复核上游变更和许可证。

| 仓库 | 许可证 | 本项目借鉴的范围 | 是否直接打包代码 |
| --- | --- | --- | --- |
| [SuInk/csu-import](https://github.com/SuInk/csu-import) | MIT | CSU `getKbxx.do` 的 `xq/jc/title` 字段、12 节作息和单双周表达 | 否；在 `caImport.ts` 中独立实现并增加边界校验 |
| [NYIST-CIPS/CourseTable](https://github.com/NYIST-CIPS/CourseTable) | MIT | WakeUp/AISchedule 的 `name/teacher/position/day/weeks/sections` 字段别名 | 否；仅作为 JSON 兼容输入 |
| [baoozak/timetable](https://github.com/baoozak/timetable) | MIT | `rowspan/colspan` 网格拉平和多学期数据隔离的设计思路 | 否；扩展内为独立实现 |
| [bkalendar/core](https://github.com/bkalendar/core) | MIT | iCalendar 的时区、重复周和例外日期语义 | 否；本项目按实际周次生成独立事件 |
| [sebbo2002/ical-generator](https://github.com/sebbo2002/ical-generator) | MIT | RFC 5545 文本转义、事件字段组织和换行折叠思路 | 否；当前保持零运行时依赖 |
| [khosbilegt/mq-timetable-exporter](https://github.com/khosbilegt/mq-timetable-exporter) | MIT | “用户主动点击 → 读取已渲染 DOM → 本地下载”的交互边界 | 否；仅用于扩展交互审查 |

## 明确不采用的实现

- [everclass/class2icalendar](https://github.com/everclass/class2icalendar) 使用 AGPL-3.0；它证明 CSU 课表可以导出 iCalendar，但本项目没有复制其代码。
- [shuakami/timetable](https://github.com/shuakami/timetable) 使用 GPL-3.0；只参考公开字段，不把实现并入前端。
- 没有许可证声明的仓库（例如 `csuhan/csugo`、`youfond/offline-timetable`、`lan-kehan/fudan-course-table-export`）只用于核对字段形状，不复制代码或资源。
- 任何需要服务端代填账号、读取认证 Cookie/令牌或绕过验证码的方案都不在本项目范围内。CSU 导入仍由用户在官方页面登录，扩展只在点击后读取已经渲染的课表。

## 本项目新增的兼容能力

- CSU JSON 仍支持顶层数组和多层 `data/result/rows` 包装。
- 同时接受 AISchedule/WakeUp 常见的 `day`、`sections`、`position`、`week`、`instructor` 等字段；所有输入最终都经过同一份课程、周次、节次和敏感字段校验。
- 课表管理页可以按用户填写的“第 1 周周一”生成 `.ics` 文件。事件在浏览器本地展开到实际周次，单双周和自定义周次不会被压缩成可能不兼容的重复规则。

