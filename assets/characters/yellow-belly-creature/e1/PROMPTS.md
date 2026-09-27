# 黄肚肚｜生成提示词

最新 v3：[肚子稍加大修订提示词](bellyE1Prompt.md)。以下为初稿及 v2 记录。

日期：2026-09-27。制作方式：内置 imagegen，transparent_background=true。
原图与修订图均原字节保存。图片参考一为用户上传的黄色角色，参考二为现有灰衣男生 E1 图，仅借鉴像素风格与车辆。没有使用 CLI。

## 初稿 character-views.png

Use case: stylized-concept.
Asset type: E1 character design turnaround sprite sheet for CSU Pixel Campus, a 2D pixel-art game.
Input image 1 is the sole character identity reference. Input image 2 is ONLY pixel-art style and scooter design reference, do NOT copy the human.
Create exactly EIGHT isolated full sprites of the yellow pear-shaped creature from reference 1 in a clean 4 columns x 2 rows evenly spaced grid on a truly TRANSPARENT background. Landscape 1536x1024 canvas.
Top row in order: front facing screen DOWN, profile facing screen LEFT, profile facing screen RIGHT, back facing screen UP. Standing neutral, hands gently on belly like reference.
Bottom row: the SAME four directions in the same order, creature seated riding a compact blue-and-cream electric step-through scooter; character and vehicle combined. Brown hands on handlebars, brown feet on footboard, big round belly fits naturally behind handlebars. Black tires and seat, pale round headlight FRONT, red taillight BACK, two mirrors, no pedals. Same vehicle design across directions.
Identity: yellow smooth bald small rounded head merging into long thick neck and large pear-shaped ROUND BELLY, light cream oval belly patch, large protruding pale green eyes with black pupils, tiny dark mouth, short stubby arms with dark olive-brown fingers, short tapered yellow legs and broad dark olive-brown three-toed feet. No ears, no hair, no tail, no clothes, no added beak. Preserve the funny calm slightly awkward expression and round heavy silhouette. BACK is plain golden yellow, no cream patch on back, no face showing from rear.
Style: clear deliberate 2D pixel clusters and stepped outlines, compact palette, about three shades per material, dark warm brown outline, not photorealistic and not a 3D render. Reference 2 only for crisp readable sprite styling; preserve the creature's own proportions, not human proportions.
Layout: each full sprite stays within its own equal cell with at least 8 percent TRANSPARENT MARGIN on ALL sides, side scooters MUST fit in their cells. Consistent creature scale across views. No cropped head, feet or wheels; no overlapping cells.
Alpha: truly transparent empty background (alpha 0), FULLY OPAQUE character and scooter interiors (alpha 255), no glow, no fog, no soft shadow, no gradient backdrop, no white matte, no checkerboard drawn into image.
No text, labels, grid lines, logo, watermark, floor, scenery, or extra characters.

## 修订 character-views-v2.png

Edit this E1 4x2 sprite sheet. Preserve the same yellow creature identity, proportions, green eyes, cream belly, brown hands/feet, blue cream scooter, all eight poses and front/left/right/back order.
REQUIRED: remove all gold and blue haze / halos surrounding the sprites. Every pixel outside the crisp brown pixel-art contour must be truly empty TRANSPARENT alpha 0. Every pixel INSIDE the creature and scooter contour must be fully opaque alpha 255, no translucency. No shadow, no glow, no dark or colored backdrop, no ambient aura. Transparent background.
Also fit bottom row side-view scooters completely INSIDE their equal 384x512 cells (left profile x384..767, right profile x768..1151) with transparent margin at least 12 pixels. Slightly reduce width of the two side sprites if needed, preserve natural proportions. No overlap or clipping between cells. Keep all full feet and wheels.
Sharp stepped pixel edges and flat clusters, no soft gradients. No text or grid. 1536x1024 landscape PNG.

## 执行结果边界

修订仍未消除主体半透明；侧面车辆也未严格缩进等宽列，预览采用独立裁切框。提示词中的要求不是已通过的验收结论，以 inspection.json 和实际预览为准。
