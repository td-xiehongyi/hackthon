# 黄肚肚｜E2 生成提示词

最新 v3 肚子修订：[行走提示词](bellyWalkPrompt.md) · [骑行提示词](bellyRidePrompt.md)。以下保留初稿及 v2 记录。

日期：2026-09-27。内置 imagegen；全部调用 transparent_background=true。第一版分别以 E1 已确认图为参考，修订分别以对应初稿为参考。全部 PNG 原字节保留。无 CLI 图像生成、无程序改写像素。

## 行走初稿

Use case: stylized-concept. E2 WALK ANIMATION sprite sheet for CSU Pixel Campus. Reference is approved character design ONLY, not background. Exactly 16 isolated sprites in a square evenly spaced 4 column x 4 row grid. TOP to BOTTOM rows: facing screen DOWN/front, LEFT profile, RIGHT profile, UP/back. Each row has FOUR distinct sequential walking phases: left foot forward/right back, passing feet together, right foot forward/left back, passing opposite foot. Clear leg swing and heel lift, natural small arm swing, short chunky stride, calm funny expression. Both side profiles must show unmistakably different leg poses in all four columns; not four standing copies. Same body proportions, eye size, belly size and silhouette in each frame, minimal torso bob.
Yellow creature: small bald rounded head merged into long neck and round heavy pear belly, cream belly patch only on front, green protruding eyes black pupils, small flat mouth, short arms and short legs, dark olive brown fingers and broad three-toed feet. No hair, ears, tail or clothes. Match reference pixel-art design. No vehicles in this image.
Consistent pixel size, crisp stepped brown contours, opaque flat pixel clusters. Keep every sprite SMALL inside equal grid cell with generous blank gutters at least 12% on all sides, full head/feet never clipped. Feet on same ground baseline per row. Same absolute character scale across all 16 frames.
Background MUST be genuine empty alpha=0, all character interior alpha=255. No aura, shadow, glow, haze, fog, soft gradients, white backdrop, checkerboard, labels, text, dividers or extra sprites. Do not reproduce the haze from the reference. Square PNG.

## 行走方向与边缘修订

Edit this exact 4x4 WALK sprite sheet, same yellow green-eyed round belly creature, same pixel art, same grid and transparent background.
Critical correction: SECOND ROW must contain FOUR sprites ALL facing SCREEN LEFT. Currently second row columns 3 and 4 incorrectly face RIGHT. Redraw ONLY second row columns 3 and 4 facing LEFT, with the opposite leg leading versus columns 1 and 2. Every head, eye, mouth, belly and toe direction in row 2 points LEFT. Row 1 all front, row 3 all right, row 4 all back, unchanged.
Also remove stray red/orange/green fringe pixels outside the dark brown outline across the whole sheet. Pure clean brown crisp outlines, completely empty transparent alpha=0 outside, solid opaque alpha=255 interiors. No glow, halo, shadow or background.
Preserve four distinct sequential walking phases per row, creature size and identity. Do not mirror an entire row to face wrong direction. No text.

## 骑行初稿

Use case: stylized-concept. Make E2 RIDING animation sprite sheet for the EXACT approved yellow creature on blue-and-cream electric scooter from the BOTTOM ROW of reference image. Same green-eyed small bald head merging into long neck, huge pear belly cream front patch, dark olive-brown hands and three-toed feet, blue cream step-through scooter black saddle and wheels, front round pale light and back red light. No clothes, ears or tail.
Exactly 16 SEPARATE FULL sprites in SQUARE evenly spaced 4 columns x 4 rows. Row 1 ALL front facing screen DOWN. Row 2 ALL screen LEFT profile, nose and front wheel to LEFT, red taillight to RIGHT. Row 3 ALL screen RIGHT profile, nose and front wheel to RIGHT, red taillight to LEFT. Row 4 ALL rear facing UP, plain yellow back, back of head no face.
Four columns are four subtle sequential scooter travel phases: visible wheel-spoke/highlight rotation, gentle 1-2 pixel body bob. Creature seated comfortably, hands stay on bars, feet on footboard, no pedaling. Within each row scooter wheelbase, wheel size, ground baseline and belly/head sizes stay consistent. Match identity of reference and natural riding pose.
Each complete sprite occupies MAX 72% of its cell width and height, especially both wheels of side scooters must fit with WIDE TRANSPARENT GUTTERS. No touching adjacent cells. Character scale consistent across views.
Crisp deliberate pixel clusters, dark brown outlines, compact flat palette, NO smooth 3D rendering or gradients.
TRUE TRANSPARENT alpha=0 BACKGROUND. Solid fully opaque alpha=255 creature and scooter. Ignore reference haze: no halo, glow, shadow, colored fringe, fog, backdrop, labels, grid, text, extra people or extra wheels.

## 骑行边缘修订

Clean up the supplied 4x4 yellow creature scooter animation sheet. Keep every sprite's identity, poses, dimensions, four directions and layout EXACTLY the same. ONLY clean the sprite edges and alpha: remove ALL stray bright red, green, yellow and blue pixels OUTSIDE the solid dark outline, especially red fringe along creature backs. No colored glow. Keep actual yellow body and blue scooter colors INSIDE the outline. Make all interior pixels fully OPAQUE alpha 255; all outside pixels TRANSPARENT alpha 0. Brown or charcoal sharp stepped single pixel outlines, no anti-aliased halo or shadow. Preserve the 16 separate complete sprites and transparent gutters.

## 实际结果

行走初稿第二行后两帧方向错误；v2 已修正，初稿不入 manifest。骑行选 v2。修订仍未完全消除局部杂色与主体半透明；提示词不是验收结论，详见 inspection.json 和 SOURCE.md。

