# 照片蓝眼长毛猫

- 固定角色 ID：`photo-point-cat`。
- 外观：灰米色背部、深色双耳及面罩、蓝眼、白色鼻梁与口鼻、大面积白色胸腹和四肢、深色蓬松长尾。
- 参考：用户提供的两张猫照片；原照片未复制入项目。第二张补充了仰卧时的胸腹与四肢毛色。
- 当前阶段：E1 四方向外观 v2 已于 2026-09-27 获用户回复“可以”确认；E2 行走、骑行及地图视觉预览获回复“符合”；E3 候选包 `0.3.0-rc.1` 已接入首页，素材技术问题和完整美术验收仍保留。
- 角色用途：用户明确选择可操控的猫，Shift 切换为猫骑电动车。现有角色接口的 16 个状态均有 E2 候选入口。
- 首页使用：是，2026-09-27 按用户要求与圆框眼镜男生一同接入。运行目录 `public/characters/photo-point-cat/` 包含 E3 原始两张 PNG 与 manifest；以 0.10 等比缩放显示，支持选择进入地图、步行和 Shift 骑电动车。

[查看 E1 预览](e1/preview.html) · [当前 v2 样张](e1/character-views-v2.png) · [首版样张](e1/character-views.png) · [来源与检查](e1/SOURCE.md)

[查看 E2 动态预览](e2/preview.html) · [E2 效果截图](e2/review-preview.png) · [骑行地图截图](e2/map-ride-preview.png) · [E2 制作与检查](e2/SOURCE.md)

[E3 完整候选包 ZIP](e3/photo-point-cat-0.3.0-rc.1.zip) · [E3 动态预览](e3/preview.html) · [E3 来源与接入说明](e3/SOURCE.md) · [文件检查](e3/package-check.json) · [压缩包检查](e3/archive-check.json)

实际首页选择、刷新记忆、侧栏头像、进入地图、左右移动、Shift 切换及返回首页换角色检查通过；已检查桌面和窄屏截图。详见 [接入记录](../../../output/character-home-integration/接入记录.md)。这不替代逐帧美术、全部碰撞路径和真实遮挡验收；彩色边缘和逐帧一致性问题继续保留。

[返回角色清单](../README.md)
