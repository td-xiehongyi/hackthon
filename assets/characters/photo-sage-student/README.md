# 棕发绿包女生

- 固定角色 ID：`photo-sage-student`。与粉白开衫女生分别维护。
- 外观：棕色齐肩微卷发、黑色绿字上衣、浅灰长裤、绿色斜挎包、白鞋；鼠尾草绿和米白电动车。
- 参考：用户提供的另一张照片；原照片未复制入库。
- 当前阶段：E1 外观于 2026-09-26 经用户回复“可以”确认；E2 动画小样已制作，等待动作审阅和美术精修。
- 首页使用：是，作为 E2 动画候选供试走；尚未交付正式包。

## 当前文件

- [E2 动态预览](e2/preview.html)、[效果截图](e2/review-preview.png)、[制作与检查记录](e2/SOURCE.md)。动态预览需通过项目开发服务器打开。
- 当前动画采用 walk-cycle-v2.png 与 ride-cycle.png；31 个不同源帧入选，16 个状态入口。正面反向包带帧已排除，暂复用有效帧。
- [E1 预览](e1/preview.html) 和 [制作说明](e1/SOURCE.md)。
- 当前审阅图：[character-views-v2.png](e1/character-views-v2.png)。
- 首次生成图：[character-views.png](e1/character-views.png)，作为历史版本保留，不是当前选定图。
- 修订检查与透明边缘问题见 E1 的 SOURCE.md、inspection.json 和 browser-check.json。

下一步：审阅 E2 动作并精修正面步态、透明边缘和逐帧一致性。12 项预览功能检查通过；真实遮挡层仍缺失，E3 和完整游戏验收尚未完成。

该角色的 prepare-review.mjs 沿用粉白开衫女生 E1 的预览布局；依赖路径已经随迁移更新。运行它会重建本角色 E1 的预览和元数据，不覆盖 PNG。

[返回角色清单](../README.md)
