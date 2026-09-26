# 中南大学像素校园

面向本机浏览器的像素校园项目：三校区连续探索，潇湘图书馆、教学楼群和体育场（副场）三个地点功能，以及共用地点相册。

当前状态（2026-09-26）：**已接入最终地图和潇湘教学楼功能页。** 地图支持拖动、缩放和适应窗口；教学楼页支持课程录入、周课表、周次与单双周、地点筛选、WakeUp 兼容 CSV 导入、CSU 教务系统辅助导入、CSV 导出、浏览器保存和社区课程汇总。蹭课页会依据个人空闲节次、周次、兴趣标签和地点筛选社区课程线索。

## 启动地图

不要直接双击 `index.html` 或使用 `file:///...` 打开：项目需要 Vite 提供前端模块和社区课表接口。

macOS / Linux 终端运行：

```bash
cd /Users/hongyaxi/Downloads/hackthon-main
npm ci                 # 仅首次运行需要；已有 node_modules 可跳过
npm run dev
```

Windows PowerShell 运行：

```powershell
cd '项目所在目录'
npm run dev
```

浏览器打开 **http://127.0.0.1:5173/**。看到“地图已加载”后，点击地图南部教学楼群的“课”标记，或右上方“进入教学楼群”。终端按 `Ctrl+C` 停止服务。

如果 5173 端口已经被占用，可改用：

```bash
npm run dev -- --port 5174
```

然后打开 **http://127.0.0.1:5174/**。开发服务停止后，社区课表接口也会停止；浏览器中的个人课表仍保留在该站点的本地存储中。

环境要求：Node.js 24。新复制的项目首次运行前执行 `npm ci`，按 `package-lock.json` 安装锁定依赖。默认端口为 5173；若该端口被占用，请按上面的 5174 方式启动。

## CSU 教务系统辅助导入

教学楼页的“从教务系统导入”会打开官方统一认证入口
[`https://ca.csu.edu.cn/`](https://ca.csu.edu.cn/)。导入是由学生在官方页面完成登录后，将已经显示的课表交给本页解析，流程如下：

1. 点击“打开 CSU 教务系统”，在新标签页中由本人完成统一认证（包括验证码、滑块或学校要求的其他验证），进入网上办事大厅/教务服务中的“我的课表”。
2. 在课表页面复制表格，或下载课表文件。教学楼页可粘贴 HTML 表格、TSV/CSV、Markdown 表格和常见的课程文本，也可直接选择 `.csv`、`.tsv`、`.txt`、`.html` 或 `.htm` 文件；Excel 文件请先另存为 CSV。
3. 回到项目，粘贴内容或选择文件，点击“解析并预览”。系统会沿用普通 CSV 导入的错误检查、周次和单双周解析、地点提示以及“追加/替换”确认，确认后才写入个人课表。

这是“辅助导入”，不是后台爬虫：

- 浏览器不会把 CSU 页面加载到项目里，也不会跨域请求教务接口、读取登录 Cookie、代填账号密码或绕过验证码；项目没有公开课表接口可安全地替代官方登录流程。
- 选择的文件只在当前浏览器内读取和解析，不会上传到项目服务器。解析器会忽略登录表单、密码、验证码等敏感字段。
- 只有用户确认保存后的课程，且仅在打开“匿名汇总”时，才会按项目既有规则同步去重课程线索；账号、密码和登录会话永不保存。关闭汇总可撤回本浏览器的贡献。
- 若浏览器阻止新标签页，请手动打开上面的官方地址；登录遇到问题应以学校官方页面为准。

## 目录结构

```text
Project/
├── src/                            # 前端源码
│   ├── app/                        # A：应用入口、页面宿主、地点注册
│   ├── game/                       # A：Phaser 场景、角色控制、碰撞与镜头
│   ├── features/
│   │   ├── teaching/               # B：教学楼群、课表与浏览器存储
│   │   ├── stadium/                # C：体育场（副场）、社团和活动查询
│   │   ├── content-editor/         # C：本机公共内容编辑器
│   │   └── library/                # D：图书馆介绍
│   └── shared/
│       ├── ui/                     # A：公共界面与基础样式
│       ├── gallery/                # D：共用地点相册
│       └── api/                    # D：统一 API 客户端
├── server/                         # D：本机服务与公共数据保存
├── public/                         # 应用直接加载的静态素材
│   ├── maps/
│   │   └── derived/campus-v9/       # A：后续地图派生素材
│   └── characters/student/         # E：正式角色 PNG 与 manifest
├── assets/                         # 素材制作源文件
│   ├── references/                 # 已有参考资料
│   ├── maps/                       # A：Tiled 标注源及编辑导出
│   └── characters/source/          # E：角色源文件、样张及来源说明
├── tools/map/                      # A：地图标注转换工具
├── tests/
│   ├── unit/                       # 逻辑单元测试
│   ├── integration/                # 模块接口与持久化集成测试
│   ├── e2e/                        # 浏览器完整流程测试
│   └── fixtures/                   # 明确标记用途的测试数据
├── data/                           # 本机运行数据，与静态构建分离
├── docs/                           # 已有分工、协议、类型声明和示例
├── output/                         # 已有最终地图、概念图与交互预览
├── 中南大学像素校园需求文档.md
├── index.html                      # 浏览器入口
├── package.json                    # 依赖与运行命令
├── package-lock.json               # 依赖锁文件
├── vite.config.ts                  # 本机启动与构建配置
├── tsconfig.json                   # TypeScript 配置
├── vitest.config.ts                # 资产检查配置
├── playwright.config.ts            # 浏览器检查配置
├── .gitignore
└── README.md
```

新建的空目录用 `.gitkeep` 保留位置；该文件不代表功能、数据或素材已经完成。

## 开发入口

- [产品需求](中南大学像素校园需求文档.md)：功能范围与待确认事项。
- [技术与接口文档](docs/README.md)：既定 React + TypeScript + Vite、Phaser、本机 Node.js + Fastify 技术方案。
- [A–E 分工](docs/01_开发分工与交付规范.md)：文件归属、协作规则与阶段验收。
- [课表与社区课池](docs/05_课表与社区课池.md)：课程模型、浏览器保存、CSV、匿名汇总接口和隐私边界。
- [共享契约](docs/contracts/campus-v1.d.ts)：当前唯一的类型声明参考。应用初始化时由 A 落地到 `src/shared/contracts.ts` 并统一维护，本次没有另建一份类型副本。
- [待标定地图示例](docs/examples/map.pending.json)：保留 pending 状态，不能直接作为已验收地图。

目录职责沿用既有分工。测试目录是本次为既定验证方案预留的位置，各模块也可就近维护测试。

## 素材与数据

- 最终地图保留于 [output/中南大学像素校园-最终地图.png](output/中南大学像素校园-最终地图.png)，运行副本为 [public/maps/campus-final-v9.png](public/maps/campus-final-v9.png)。已核对两者字节、SHA-256 及 1041 × 1511 尺寸一致。通行、碰撞与交互区域仍待单独标定。
- `public/characters/student/` 当前没有正式角色素材或虚构的 manifest。
- 个人课表保存在当前浏览器的站点存储中，刷新后保留，并可导出 CSV 备份。更换设备、浏览器或站点端口前应先导出。
- 开启“匿名汇总”时，当前课表的课程字段会按随机安装 ID 保存到 `data/community-schedules.json`。其他用户只能读取去重后的课程和来源份数，不能读取用户 ID 或整份原始课表；关闭开关会撤回本浏览器的贡献。
- `.gitignore` 排除 `data/` 运行数据、依赖、构建产物和测试报告；构建不会覆盖课表汇总数据。地点相册和公共内容的数据目录规则仍按既有接口文档执行。

## 检查与构建

| 命令 | 作用 |
|---|---|
| `npm test` | 检查地图资产、周次、WakeUp CSV、课表保存与导出 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm run test:e2e` | 使用本机 Edge 验证地图、课程录入、刷新保存、CSV、蹭课筛选、移动端和浏览器后退 |
| `npm run build` | 类型检查并生成 `dist/` 静态构建，不修改 `data/` |
| `npm run preview` | 在同一地址预览静态构建；需先停止开发服务 |

地图加载与相机浏览由 [CampusMapScene](src/game/CampusMapScene.ts) 负责；React 宿主为 [MapViewport](src/game/MapViewport.tsx)，应用页面为 [App](src/app/App.tsx)。Phaser 按[官方模板基线](https://github.com/phaserjs/template-react-ts/blob/main/package.json)固定为 4.0.0，实际安装版本以锁文件为准。构建存在 Phaser 体积较大的提示，目前用于本机预览。

## 已知边界与后续项

当前的教学楼热点是用于发现功能的图像坐标，不是已验证的角色入口、碰撞区或安全返回点。实际楼座目录和学校校历尚未核验：课表因此保留用户输入的地点原文，手动选择教学周，不猜测楼座 ID 或当前校历周。

社区课池是用户课表线索，不是学校完整排课、教室实时占用或旁听许可。当前匿名身份适合 hackathon/本机实例；对外公开部署前还需加入账号或签名凭据、学期 ID 管理和服务端权限校验。角色、可行走区域、碰撞、图书馆/体育场页面和地点相册仍待接入。项目仓库为 [td-xiehongyi/hackthon](https://github.com/td-xiehongyi/hackthon)，主分支为 `main`。
