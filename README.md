# 中南大学像素校园

面向本机浏览器的像素校园项目：三校区连续探索，潇湘图书馆、教学楼群和体育场（副场）三个地点功能，以及共用地点相册。

当前状态（2026-09-26）：**已接入最终地图，可启动本机浏览器预览。** 支持拖动、滚轮或按钮缩放、适应窗口，以及图片加载失败提示。角色移动、地图标定和地点功能尚未接入；原有需求、地图及历史预览文件保留。

## 启动地图

本机已安装依赖。在 PowerShell 中运行：

```powershell
cd 'C:\Users\xie\Desktop\Project'
npm run dev
```

浏览器打开 **http://127.0.0.1:5173/**。看到“地图已加载”和校园图片即表示预览已启动；按住鼠标左键拖动、滚轮缩放，或使用右上方按钮。终端按 `Ctrl+C` 停止服务。

环境要求：Node.js 24。新复制的项目首次运行前执行 `npm ci`，按 `package-lock.json` 安装锁定依赖。端口固定为 5173，被占用时会报错；先确认已有预览是否正在运行。

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
- [共享契约](docs/contracts/campus-v1.d.ts)：当前唯一的类型声明参考。应用初始化时由 A 落地到 `src/shared/contracts.ts` 并统一维护，本次没有另建一份类型副本。
- [待标定地图示例](docs/examples/map.pending.json)：保留 pending 状态，不能直接作为已验收地图。

目录职责沿用既有分工。测试目录是本次为既定验证方案预留的位置，各模块也可就近维护测试。

## 素材与数据

- 最终地图保留于 [output/中南大学像素校园-最终地图.png](output/中南大学像素校园-最终地图.png)，运行副本为 [public/maps/campus-final-v9.png](public/maps/campus-final-v9.png)。已核对两者字节、SHA-256 及 1041 × 1511 尺寸一致。通行、碰撞与交互区域仍待单独标定。
- `public/characters/student/` 当前没有正式角色素材或虚构的 manifest。
- `data/` 当前没有业务数据。后续由服务的明确初始化流程建立 `public-content.json`、`photos/index.json` 和 `photos/files/`，不得把读取失败当成首次初始化。
- `.gitignore` 排除运行数据、依赖、构建产物、测试报告和本机环境配置；保留 `data/.gitkeep`。个人课表按现有约定保存在浏览器 IndexedDB。

## 检查与构建

| 命令 | 作用 |
|---|---|
| `npm test` | 检查地图运行副本与指定原图的字节、哈希和尺寸 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm run test:e2e` | 使用本机已安装的 Chrome 验证加载、缩放、拖动、恢复全图与加载失败提示 |
| `npm run build` | 类型检查并生成 `dist/` 静态构建，不修改 `data/` |
| `npm run preview` | 在同一地址预览静态构建；需先停止开发服务 |

地图加载与相机浏览由 [CampusMapScene](src/game/CampusMapScene.ts) 负责；React 宿主为 [MapViewport](src/game/MapViewport.tsx)，应用页面为 [App](src/app/App.tsx)。Phaser 按[官方模板基线](https://github.com/phaserjs/template-react-ts/blob/main/package.json)固定为 4.0.0，实际安装版本以锁文件为准。构建存在 Phaser 体积较大的提示，目前用于本机预览。

## 尚未实现

当前只有前端地图预览，没有启动 Fastify、本机上传或公共数据服务，没有角色、可行走区域、碰撞、入口或地点页面。浏览画面的拖动和缩放是预览控件，不是角色移动。地图标注继续使用文档中的 pending 状态，程序不把整张底图当作可通行场景。

下一步由 A 落地共享类型、地点注册和地图标定，由 D 接入本机服务。此预览不代表 P0、地理核验或业务功能已验收。项目仓库为 [td-xiehongyi/hackthon](https://github.com/td-xiehongyi/hackthon)，主分支为 `main`。
