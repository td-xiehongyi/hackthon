# 临时角色素材来源

**用途：A 的临时测试素材，不是 E 交付的正式角色，也不代表人物外观已确认。**

- 来源：队友原型 `hackthon-character-playground-prototype`（README 自述“占位造型，不是最终美术”），由其 `tools/generate-sprites.js` 代码绘制。
- 雪碧图：`character-sheet.png` 按字节原样复制，240 × 176，RGBA，SHA-256 `470f5fc8ad0e5ae7d913c605d2703ed121810f5d1b1067a505ebd013ca6797f4`。
- 帧尺寸 20 × 22；锚点统一取帧内 (10, 20) 作为脚底落地点。
- 状态映射：walk/idle←idle，walk/move←walk，**ride/idle←idle、ride/move←run（原型没有电动车造型，骑行外观仅为临时顶替）**。
- 原型的 4 个斜向方向未被引用；契约只要求 up/down/left/right。
- 由 `node tools/character/import-prototype.mjs <原型目录>` 生成；重新生成会覆盖本目录。
