# 中南大学像素校园

本机浏览器应用：在三校区像素地图上探索，并通过地点入口打开功能页。

## 当前交付（2026-09-26）

A 的公共框架已在此仓库接入：v20 地图、WASD 移动、Shift 骑行、脚底碰撞、镜头、E 键交互、页面暂停与原位返回、地图搜索/标记和安全点快速移动。图书馆、相册和数据服务沿用 D 的实现；体育场、公共内容编辑沿用 C 的实现并完成联调。

**真实地图入口仍未标定，所以首页暂不提供地点 E 键入口。** 完整进入/退出流程可在开发测试场景体验。教学楼业务由 B 交付，目前为明确标注的占位页；三个地点均复用 D 的相册。

A 的交付范围、测试证据与未验证项见 [A 部分交付记录](docs/05_A部分交付与验收.md)。

## 启动

### 一键启动（Windows）

双击根目录的 **`一键启动.bat`**。脚本会启动前端与本机数据服务，并自动打开 [校园地图](http://127.0.0.1:5176/)。保留启动窗口；按 Ctrl+C 或关闭窗口即可停止服务。重复双击会识别并复用本目录的一键启动实例。

此脚本固定使用 5176/8789，数据保存在本项目 `data/`，图片政策保持待配置。端口被其他服务占用时提示错误，不结束其他程序，也不自动更换地址。需要 Node.js 24；首次缺少依赖时按提示执行 `npm ci`。

### 分别启动

Node.js 24；新目录先运行 `npm ci`。在两个 PowerShell 终端中运行：

```powershell
# 终端 1：本机数据服务（正式图片政策保持 pending）
cd 'C:\Users\xie\Desktop\多人\hackthon'
npm run server
```

```powershell
# 终端 2：前端
cd 'C:\Users\xie\Desktop\多人\hackthon'
npm run dev
```

打开 [校园地图](http://127.0.0.1:5173/)。默认角色模式，WASD 移动，按住 Shift 骑行；“浏览”可拖动全图，“通行区域”显示碰撞边界，“地图总览与搜索”可搜索地点。未登记的坐标、安全点保持缺失状态。

打开 [开发测试场景](http://127.0.0.1:5173/?scene=dev-playground)，点击“图书馆范围”“教学楼群范围”或“副场范围”，按 E 进入，点击“返回校园”回原位置。副场页面可进入“维护社团与活动”。测试地形与真实地图坐标无对应关系。

如需测试真实图片上传，先停止数据服务，再在终端 1 明确启用开发图片政策：

```powershell
$env:CAMPUS_IMAGE_POLICY = 'dev'
npm run server
```

这是 D 提供的开发配置（PNG/JPEG/WebP/GIF、单张 10 MB），不代表图片政策已经确认。退出后可执行 `Remove-Item Env:CAMPUS_IMAGE_POLICY` 恢复默认。数据在本仓库 `data/` 中，构建和浏览器测试不修改它；不要复制其他目录的用户数据。

开发端口为 5173、服务端口为 8787，占用时报错。若另一个 Project 预览仍占用默认端口，可让本仓库使用独立来源：

```powershell
# 终端 1
$env:CAMPUS_PORT = '8789'
$env:CAMPUS_ALLOWED_ORIGINS = 'http://127.0.0.1:5176,http://127.0.0.1:8789'
npm run server
```

```powershell
# 终端 2
$env:CAMPUS_API_PORT = '8789'
npm run dev -- --port 5176
```

此时打开 http://127.0.0.1:5176/ 。浏览器私人数据按来源隔离，后续 B 的课表功能换端口前应先备份。

## 检查与构建

| 命令 | 用途 |
|---|---|
| `npm test` | 地图哈希、几何、连通、移动、角色 manifest、会话、定位与 C/D 回归 |
| `npm run build` | 类型检查与生产构建 |
| `npm run test:e2e` | Chrome 浏览器端到端验证，自动启停 5175/8788，使用独立 `.cache/e2e-*` 数据 |
| `npm run map:annotate` | 从 v20 提取道路与草地，应用独立通行修正规则，保留已有地点/楼座/安全点等数据 |
| `npm run preview` | 预览 `dist/`；需同时运行数据服务，开发前端应先停止 |

浏览器测试拒绝复用已有服务，防止连到其他目录。`.cache/`、`dist/` 和测试报告均不提交。Windows 受限环境如无法清理测试子进程，需在允许子进程管理的普通终端运行测试。

## 文件入口

- `src/app/`：页面宿主、地点注册组件、地图定位总览、体育场集成。
- `src/game/`：场景、标注校验、移动、碰撞、交互、角色和测试场景。
- `src/shared/contracts.ts`：唯一运行时共享契约；C 原类型文件已改为重导出。
- `src/shared/place-registry.ts`：三个固定地点；空楼座目录保留待核验。
- `public/maps/campus-v20.png` 与 `.annotations.json`：运行底图和生成的通行标注。
- `assets/maps/campus-v20.navigation.json`：草地/树木/操场/桥的通行修正及建筑、水域边界；重新生成时保留，修改说明见 [碰撞与通行规则](docs/07_碰撞与通行规则.md)。
- `assets/maps/`、`tools/map/`：蒙版、检查图和生成工具。
- [assets/characters/README.md](assets/characters/README.md)：全部角色的统一清单；每角色独立目录保存 E1/E2 等阶段素材、来源、预览与状态。
- `public/characters/temp-prototype/`：当前临时角色的运行副本；原件在 `assets/characters/temp-prototype-blob/runtime/`。
- `src/features/`、`src/shared/gallery/`、`src/shared/api/`、`server/`：队友模块，保留现有实现。

E 交付符合 [角色接口](docs/04_角色素材接口.md) 的正式素材并由 A 复核显示比例后，可将选定版本复制到 `public/characters/<character-id>/`，设置 `VITE_CHARACTER_DIR=/characters/<character-id>` 后再启动或构建前端。当前照片角色仍在样张/动画小样阶段，默认角色未替换。新增角色、版本及导出步骤见 [角色目录与新增流程](docs/06_角色目录与新增流程.md)。运行时会校验 manifest、帧范围与精灵图尺寸；高分辨率原图仍需要明确配置等比缩放。

## 验收边界

- v20 通行范围由颜色提取与独立修正规则合成：草地、操场、路边和建筑附近的树木开放，窄路允许骑行，桥面可上桥并接岸。建筑和水面保持阻挡；边界与地理核验仍为 `pending`。
- 三处真实入口、真实楼座、出生及快速移动落点缺失；不写入截图目测坐标。
- 遮挡排序和素材加载已接线，真实建筑/树木分层素材尚未交付；合成测试树不是正式地图遮挡验收。
- 角色为临时造型，骑行用跑动动画替代；速度和脚底尺寸为开发参数。
- 教学楼课程表由 B 交付；图书馆正文与来源、图片正式政策仍待确认。
- 原 v9 地图、历史素材保留；本次未修改 `Desktop\Project`，未提交、推送或合并分支。

[需求文档](中南大学像素校园需求文档.md) · [开发分工](docs/01_开发分工与交付规范.md) · [技术接口](docs/README.md)
