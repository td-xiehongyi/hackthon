# 中南大学像素校园

面向本机浏览器的像素校园项目：三校区连续探索，潇湘图书馆、教学楼群和体育场（副场）三个地点功能，以及共用地点相册。

当前状态（2026-09-26）：运行底图为 **v20**，角色在道路、步道和桥面上跑动（通行范围自动提取，待核验）。**本机数据服务与图书馆功能页已接入**：在测试场景按 E 进入图书馆，可上传真实图片，保存到本机 `data/`，刷新、重启服务或换浏览器后仍能看到；三个地点相册互相隔离。教学楼群与体育场（副场）功能页仍为占位；正式地图上三个地点入口仍待标定。

## 启动

需要两个终端（Node.js 24，首次在新目录运行前先 `npm ci`）：

```powershell
cd 'C:\Users\xie\Desktop\Project'
npm run server:init     # 仅首次：建立 data/ 下的空公共内容与空相册；已有数据时不会覆盖
npm run server:dev      # 终端 1：本机数据服务 127.0.0.1:8787（开发测试图片政策）
npm run dev             # 终端 2：前端 127.0.0.1:5173
```

浏览器打开 **http://127.0.0.1:5173/**，角色即在地图中心：WASD 跑动，按住 Shift 骑行，“回到角色”把镜头拉回角色，“浏览”切换到拖动浏览全图，“通行区域”显示绿色可通行、红色阻挡。

试用图书馆与相册：打开 **http://127.0.0.1:5173/?scene=dev-playground**，点“图书馆范围”（或走进蓝色虚线框）后按 E，在图书馆页上传图片，点“返回校园”回到原位。

- `npm run server:dev` 启用**开发测试图片政策**（JPEG/PNG/WebP，单张 ≤ 10 MB），启动时会醒目提示，不是用户确认的政策（D-13）。
- `npm run server` 为正式启动：图片政策保持“待配置”，相册可查看但不能上传。
- 只监听 127.0.0.1；端口 5173、8787 被占用时直接报错，不换端口。终端按 `Ctrl+C` 停止。
- 数据服务未启动时，前端仍可浏览地图，相册会显示“本机数据服务未启动或暂时不可用”。
- 数据文件已损坏或缺失时，服务拒绝启动并保留原文件，不会自动清空。

## 道路与障碍标定

通行范围按底图颜色自动提取，不凭目测坐标：

```powershell
npm run map:annotate
```

1. `tools/map/extract-walkable.mjs` 把浅黄步道/广场、蓝灰公路判为可通行；草地、树、建筑、水面、跑道、标牌判为阻挡。路面上的行人、车辆、标线等小物件补为可通行，孤立的浅色碎片去除。颜色识别不了但画面上明显连续的通道（玉带湖步行桥、岳麓山南门门洞等），在脚本的 `BRIDGES` 中手工补上，每条都写明原因。
2. 产物：`assets/maps/campus-v20.walkable.png`（蒙版）和 `assets/maps/campus-v20.walkable-check.png`（检查图：黄=步道，蓝=公路，红=阻挡）。
3. `tools/map/build-annotation.mjs` 把蒙版转为契约格式 `public/maps/campus-v20.annotations.json`，状态保持 `pending`。

`npm test` 会检查：标注与底图哈希一致、多边形合法、水面与建筑内部不可站立，并且从地图中心出发，步行和骑行都能到达三个校区的关键位置（岳麓山图书馆、南门、麓南二食堂、潇湘副场、教学楼群、图书馆、玉带湖桥等）。

发现走不通或能穿墙的地方时，调整脚本中的颜色阈值或 `BRIDGES`，重新运行 `npm run map:annotate`。核对检查图确认无误后，才可把 `annotationStatus` 改为 `verified`。

## 开发测试场景（临时）

开发服务运行时打开 **http://127.0.0.1:5173/?scene=dev-playground**。WASD 移动，按住 Shift 骑行，红框为脚底碰撞体。走进彩色虚线框（临时互动范围）会出现“按 E 进入【地点名称】”，按 E 打开对应功能页，点“返回校园”回到按 E 时的位置。侧栏有“开发瞬移”按钮，可直接跳到各范围、重叠区或范围外。

- 地形与三个互动范围为合成测试数据，与 v20 地图无坐标对应，不写入任何地图标注；范围只是借用三个固定 placeId，不是真实入口。教学楼群与副场两个范围有意重叠，用于验证目标选择。
- 角色为队友原型 `hackthon-character-playground-prototype` 的占位造型，经 `node tools/character/import-prototype.mjs <原型目录>` 转为契约 manifest，放在 `public/characters/temp-prototype/`（不占用 E 的正式目录）。原型没有电动车造型，骑行外观暂以奔跑动画顶替。
- 速度（步行 60、骑行 120 像素/秒）与碰撞体尺寸是开发调试值，不是已确认参数。
- 仅开发模式可用；生产构建不包含该入口。

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

- 当前运行底图为 v20：源图 [output/concepts/沿线地标图-清水路北端接通-v20-步道拓宽与避让.png](output/concepts/沿线地标图-清水路北端接通-v20-步道拓宽与避让.png)，运行副本 [public/maps/campus-v20.png](public/maps/campus-v20.png)，`npm test` 核对两者字节、SHA-256 及 1041 × 1511 尺寸一致。地图仍在完善；通行、碰撞与交互区域仍待单独标定。此前的 v9 定稿图保留于 `output/中南大学像素校园-最终地图.png`。
- `public/characters/student/` 当前没有正式角色素材或虚构的 manifest。
- `data/` 当前没有业务数据。后续由服务的明确初始化流程建立 `public-content.json`、`photos/index.json` 和 `photos/files/`，不得把读取失败当成首次初始化。
- `.gitignore` 排除运行数据、依赖、构建产物、测试报告和本机环境配置；保留 `data/.gitkeep`。个人课表按现有约定保存在浏览器 IndexedDB。

## 检查与构建

| 命令 | 作用 |
|---|---|
| `npm run test:integration` | 本机数据服务：初始化与损坏保护、来源校验、公共内容版本冲突与校验、相册隔离、幂等与并发、格式/大小/容量、文件缺失 |
| `npm test` | 地图运行副本哈希与尺寸、共享契约、会话与关闭检查、角色 manifest、移动与碰撞逻辑 |
| `npm run typecheck` | 检查 TypeScript 类型 |
| `npm run test:e2e` | 使用本机 Chrome 验证地图与角色、E 键进入与返回、图书馆上传/刷新/跨浏览器相册/结果未确认重试。会自动启动数据服务，使用独立的 `.cache/e2e-data`，不碰 `data/`；运行前请先停止 8787 上的服务 |
| `npm run build` | 类型检查并生成 `dist/` 静态构建，不修改 `data/` |
| `npm run preview` | 在同一地址预览静态构建；需先停止开发服务 |

地图加载与相机浏览由 [CampusMapScene](src/game/CampusMapScene.ts) 负责；React 宿主为 [MapViewport](src/game/MapViewport.tsx)，应用页面为 [App](src/app/App.tsx)。Phaser 按[官方模板基线](https://github.com/phaserjs/template-react-ts/blob/main/package.json)固定为 4.0.0，实际安装版本以锁文件为准。构建存在 Phaser 体积较大的提示，目前用于本机预览。

## 尚未实现

- v20 通行范围为自动提取、待用户核对（`annotationStatus: pending`）；三个互动入口、出生点与安全点尚未标定，正式地图上暂无 E 键互动。起点暂取地图中心附近可站立位置。
- 建筑与树木的前后遮挡尚未处理：底图是一整张图，角色始终画在最上层。
- 教学楼群（课表）与体育场副场（社团活动、内容编辑器）功能页尚未实现，仍为占位页。
- 图书馆介绍与来源尚未核验，页面显示缺失状态。
- 图片格式与大小限制（D-13）尚未确认；目前只有开发测试配置。
- 正式角色（含电动车造型）由 E 交付；当前角色为临时占位。

项目仓库为 [td-xiehongyi/hackthon](https://github.com/td-xiehongyi/hackthon)，主分支为 `main`。
