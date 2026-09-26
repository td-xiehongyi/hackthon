# 角色素材库

所有角色从这里查找和维护。固定角色 ID 对应一个目录，E1、E2 等阶段放在同一角色目录里。

更新日期：2026-09-26。当前登记 **3 个角色**，其中 2 个照片角色、1 个临时测试角色。E1/E2 是制作阶段，不计为不同角色。

## 角色清单

| 固定 ID / 角色目录 | 显示名称 | 最新阶段及状态 | 当前预览 / 素材 | 首页使用 |
|---|---|---|---|---|
| [photo-student](photo-student/README.md) | 粉白开衫女生 | E1 外观已确认；E2 动画小样已制作，正式验收未完成 | [E2 动态预览](photo-student/e2/preview.html) · [效果截图](photo-student/e2/review-preview.png) | 否 |
| [photo-sage-student](photo-sage-student/README.md) | 棕发绿包女生 | E1 外观已确认；E2 动画小样已制作，待动作审阅和美术精修 | [E2 动态预览](photo-sage-student/e2/preview.html) · [效果截图](photo-sage-student/e2/review-preview.png) | 否 |
| [temp-prototype-blob](temp-prototype-blob/README.md) | 临时测试角色 | 临时 16 状态；骑行以跑动顶替，无真实车辆 | [原始素材包](temp-prototype-blob/runtime/) · [精灵图](temp-prototype-blob/runtime/character-sheet.png) | 是，未设置角色目录时的默认值 |

每个角色的 README 是该角色当前状态入口。详细检查依据保存在对应阶段的 SOURCE.md、检查报告和图片中。清单中的“制作完成”不能替代“已确认”“已接入”或“验收通过”。

## 目录

```text
assets/characters/                   ← 角色素材总入口
  README.md                         ← 全部角色清单
  photo-student/                    ← 一个角色一个固定目录
    README.md                       ← 身份、最新阶段、已确认和未完成项
    e1/                             ← 外观图、修订图、来源、预览
    e2/                             ← 动画、候选 manifest、验证、预览
  photo-sage-student/
    README.md
    e1/
  temp-prototype-blob/
    README.md
    runtime/                        ← 既有临时包的统一维护原件
  source/                           ← 旧路径兼容入口，仅说明和跳转

public/characters/                  ← 应用读取的运行副本
  temp-prototype/                    ← 当前临时角色的旧运行路径，继续兼容
  student/.gitkeep                   ← 历史占位，不是角色，也不是正式素材
```

后续角色按 `<character-id>/README.md`、`<character-id>/e1/`、`<character-id>/e2/` 等结构增加。只建立实际用到的阶段；完整素材验收后才建立正式发布包和运行副本。`source/` 不再接收新的素材。

**维护原则：原件和阶段记录在 `assets/characters/`；`public/characters/` 只保留运行必需文件的导出副本。** 不在两处独立修改同一素材。临时包目前两处的 PNG、manifest、SOURCE 按字节一致；重新导入工具也会先写原件再同步副本。

## 使用方法

- 看已有角色：从上面的表格进入角色 README，再打开最新阶段的预览。
- E1 静态预览支持直接打开 HTML；E2 动态预览需要项目开发服务器。
- 新增、修订、导出和多人同时制作的规则见 [角色目录与新增流程](../../docs/06_角色目录与新增流程.md)。
- PNG、manifest、16 状态、锚点等技术要求继续以 [角色素材接口](../../docs/04_角色素材接口.md) 为准。
- 登记素材不等于已实现游戏内角色选择菜单；当前应用仍通过启动配置选择一套角色。

## 旧目录迁移

| 旧位置 | 当前维护位置 |
|---|---|
| `assets/characters/source/photo-student-e1/` | `assets/characters/photo-student/e1/` |
| `assets/characters/source/photo-student-e2/` | `assets/characters/photo-student/e2/` |
| `assets/characters/source/photo-sage-student-e1/` | `assets/characters/photo-sage-student/e1/` |
| `public/characters/temp-prototype/` | 原件统一到 `assets/characters/temp-prototype-blob/runtime/`；原运行路径保留为副本 |

前三个旧目录只保留说明和预览跳转，不重复存放 PNG。历史直接图片链接应改用上面的当前目录；旧预览 HTML 继续跳转。移动的 32 个文件在迁移时逐个核对了 SHA-256，之后仅更新路径、文档和候选角色 ID。历史报告中的旧 URL 是当时记录，不表示现在仍在旧目录维护。
