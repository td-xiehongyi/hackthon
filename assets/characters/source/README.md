# 角色与电动车素材说明（E 工作线）

版本：v0（占位素材）
状态：**临时测试素材，非最终人物美术**。按 [角色素材接口](../../../docs/04_角色素材接口.md) §6 的 A/E 分工，这套素材用于让 A 提前接入 WASD 移动、Shift 骑行切换、状态机和碰撞逻辑，不代表最终角色外观已经确认。正式美术定稿后，只需替换本目录下的 PNG 并重新生成 `manifest.json`，不需要改变文件结构或 `sheets`/`clips` 字段命名。

## 1. 文件清单

| 文件 | 说明 |
|---|---|
| `assets/characters/source/generate-placeholder-sprites.cjs` | 生成脚本（源文件），程序化画出下面两张精灵图和 manifest。运行 `node assets/characters/source/generate-placeholder-sprites.cjs` 可重新生成。 |
| `public/characters/student/walk-sheet.png` | 步行精灵图，96×192px |
| `public/characters/student/ride-sheet.png` | 骑行（人车合一）精灵图，168×224px |
| `public/characters/student/manifest.json` | 帧坐标、锚点、时长等元数据，字段严格对应 [`CharacterManifest`](../../../docs/contracts/campus-v1.d.ts) 契约 |

## 2. 覆盖的 16 个状态

按 [角色素材接口](../../../docs/04_角色素材接口.md) §4 要求的 **2 模式 × 4 方向 × 2 动作 = 16 个状态入口**，全部覆盖：

| 模式 | 方向 | 动作 |
|---|---|---|
| `walk`（步行） | `up`、`down`、`left`、`right` | 每个方向都有 `idle`（待机 1 帧）和 `move`（走路 2 帧交替） |
| `ride`（骑电动车，人车合一） | `up`、`down`、`left`、`right` | 每个方向都有 `idle`（待机 1 帧）和 `move`（骑行 2 帧交替） |

**朝向命名是屏幕方向，不是地理方位**：`up` = 画面上方，`down` = 画面下方，`left`/`right` 同理。

### 2.1 实际只画了 3 个方向，`left` 是镜像出来的

为了压缩工作量，实际手绘（脚本绘制）的只有 `down`、`up`、`right` 三个方向；`left` 由 `right` 水平镜像自动生成（脚本里的 `mirrorH()`）。这要求人物和电动车的外观左右对称——本版占位素材（纯色块拼装、无方向性图案）天然满足这个条件；如果后续正式美术想加不对称细节（比如书包只背一侧、车头装饰偏一边），`left` 就不能再用镜像，需要单独画。

### 2.2 `up`（背面）视角不画脸

按像素游戏的常见做法，背面视角只画后脑勺/背包轮廓，不画眼睛嘴巴——因为现实中站在人物背后本来就看不到脸。`down`（正面）和 `right`/`left`（侧面）都画了眼睛和嘴巴；侧面视角画成"两眼都露出"的可爱风格（近似 3/4 侧脸），不是严格的纯侧脸单眼画法。

## 3. 精灵图尺寸与网格布局

两张图都是**同一张图里按网格拼放全部帧**的雪碧图（sprite sheet）形式，行 = 方向，列 = 动作帧：

### 3.1 `walk-sheet.png`（96×192px）

单帧画布 32×48px，4 行（down / up / right / left）× 3 列（idle / move0 / move1）：

```
        col0(idle)   col1(move0)  col2(move1)
row0 down    (0,0)      (32,0)       (64,0)
row1 up      (0,48)     (32,48)      (64,48)
row2 right   (0,96)     (32,96)      (64,96)
row3 left    (0,144)    (32,144)     (64,144)
```

### 3.2 `ride-sheet.png`（168×224px）

单帧画布 56×56px，同样 4 行 × 3 列：

```
        col0(idle)   col1(move0)  col2(move1)
row0 down    (0,0)      (56,0)       (112,0)
row1 up      (0,56)     (56,56)      (112,56)
row2 right   (0,112)    (56,112)     (112,112)
row3 left    (0,168)    (56,168)     (112,168)
```

具体每一帧的精确矩形坐标以 `manifest.json` 里的 `rect` 字段为准，上表只是方便人工核对的示意；两者必须一致（已有单元测试 `tests/unit/character-manifest.test.ts` 自动校验这一点）。

## 4. 锚点（脚底/车轮落地点）

`anchor` 是每帧局部像素坐标里的地面落地点，原点是**当前帧裁切矩形的左上角**（不是整张图的左上角）。同一动作换帧、换方向、步行/骑行切换时，这个点在世界坐标里必须保持不动。

| 模式 | 方向 | anchor (x, y) | 说明 |
|---|---|---|---|
| walk | down / up | (16, 47) | 画布水平中心，最底部 |
| walk | right | (17, 47) | 画布水平中心，最底部 |
| walk | left | (14, 47) | 镜像自 right：`32 - 17 = 15`，脚本按镜像公式算出 14（取整），已通过对称性单元测试校验（容差 ±1px） |
| ride | down / up | (28, 51) | 车轮落地点参考，画布水平中心，接近底部 |
| ride | right | (28, 47) | 车轮落地点参考 |
| ride | left | (27, 47) | 镜像自 right |

**为什么骑行的 anchor 比画布底部（y=55）还高几像素**：车轮本身有半径，anchor 取的是车轮与地面接触的那一条线，不是整张图的最底边——图的最底边留了一点车轮阴影/透明边距。

## 5. 命名与生成方式

本版素材不是一张一张单独画的 PNG，而是用 Node 脚本按坐标程序化拼出整张雪碧图，所以没有"每帧一个文件"的命名规则——`walk-sheet.png` / `ride-sheet.png` 两个文件名本身就是全部命名。`manifest.json` 里的 `rect` 字段唯一确定每一帧在哪张图的哪个位置，不依赖文件名做区分。

如果后续正式美术改用"每帧单独一张小图"的组织方式（比如 `walk_down_idle_0.png`、`walk_down_move_0.png`、`walk_down_move_1.png`……），需要同步更新 `manifest.json` 里对应的 `sheets`（增加更多 sheet 条目或改用逐帧文件）和每个 `frame.rect`（改成整张小图的 0,0 到其宽高），但 `clips` 的 16 个状态结构和 `mode`/`facing`/`action` 字段不需要变。

## 6. 素材来源

本版（v0）为**占位素材**，纯代码生成（`generate-placeholder-sprites.cjs`），不基于任何外部图片、素材站或第三方美术资源，也不构成任何版权依赖。配色为脚本内 `P` 调色板任意选定，不代表中南大学官方色彩规范或最终人物设计方向。

正式美术定稿后，本节需要更新为实际的来源说明（自绘 / 外包 / 授权素材及许可证条款等），并在替换 PNG 时同步更新 `characterId`（当前为 `csu-campus-placeholder-v0`）以区分版本。

## 7. 已知局限（v0）

- 纯色块拼装，无精细笔触、无阴影渲染，细节程度低于最终验收要求
- 骑行状态的"人车合一"画法只做了车轮/车把手/车灯的基本布局，未做真实骑跨姿态
- 未经过美术风格与地图（`public/maps/campus-final-v9.png`）及像素参考图（`assets/references/pixel-style-reference*.png`）的比例/色调比对
- `durationMs`（idle 1000ms、move 每帧 220ms）是脚本给的示意值，不代表最终动画节奏或移动速度已确认——按 [角色素材接口](../../../docs/04_角色素材接口.md) §5，这个数值不等于移动速度，A 会按实际需要调整

## 8. 结构校验

`tests/unit/character-manifest.test.ts` 覆盖以下自动检查（不代表视觉质量已验收，只保证数据结构合规）：

- `manifest.json` 存在且可解析，`schemaVersion` 固定为 1
- 每个 sheet 的 `url` 文件存在，PNG 实际像素尺寸与声明一致
- 恰好 16 个 `(mode, facing, action)` 组合，无重复、无缺失
- 每个 clip 的 `loop` 为 `true`，帧数至少 1
- 每帧 `rect` 不越界（`x + width ≤ sheet.width` 等），`durationMs` 为正数
- 每帧 `anchor` 落在该帧画布范围内
- `left`/`right` 镜像后的 anchor 保持水平对称（容差 ±1px）

运行：`npm test`
