# 临时测试角色

- 固定角色 ID：`temp-prototype-blob`，与现有 manifest 一致。
- 当前状态：A 使用的临时测试素材；不是照片角色，也不是正式美术交付。
- 统一维护位置：[runtime/](runtime/)。来源见 [SOURCE.md](runtime/SOURCE.md)。
- 应用运行副本：`public/characters/temp-prototype/`。保留原路径以兼容当前首页、测试和已有启动方式。
- 角色为 240 × 176 精灵图，帧为 20 × 22，包含 16 状态入口；骑行仍以跑动顶替，图中没有电动车。

## 维护

`tools/character/import-prototype.mjs` 先写本目录的 runtime 包，再复制 PNG、manifest 和 SOURCE 到运行目录。不要只修改运行副本。

重新导入依赖外部原型目录；本次整理仅收拢现有有效文件并核对两处字节一致，不代表重新取得或验证了外部原型工程。

首页在未设置 `VITE_CHARACTER_DIR` 时仍使用本角色。将来切换其他角色后，也保留此包和来源用于测试回归，清楚标记是否还在使用。

[返回角色清单](../README.md)
