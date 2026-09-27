# 黄肚肚｜E3 修订提示词

日期：2026-09-27。内置 imagegen，transparent_background=true。分别以 E2 肚子加大版 walk-cycle-v3.png 与 ride-cycle-v3.png 为编辑目标，原图保留；本阶段只做图像模型编辑，没有程序改写 PNG。

## 行走腹斑与边缘修订

Use case: precise-object-edit. Edit the attached 4x4 WALK sprite sheet with minimal changes. Preserve ALL existing sixteen sprites, cell locations, facing directions (rows FRONT, LEFT, RIGHT, BACK), exact plump belly size, head face proportions, leg poses, pixel art and source canvas 1254x1254.
Task 1: remove tiny detached and colored red/green/yellow fringe pixels outside the dark brown outline. Replace colored edging with the existing natural dark brown outline. NO glow, halo, blur or shadow. Empty background must be genuine alpha0. Body interiors fully opaque alpha255, solid pixel-art fills.
Task 2: in row TWO (all LEFT facing), stabilize the cream belly patch: in column THREE its patch is too tall up toward the neck. Adjust only that cream patch to the same height and curved front-abdomen placement as row2 columns1,2,4; keep arm overlap and pose unchanged. Preserve the slightly enlarged belly everywhere; do NOT shrink it.
Do NOT redraw the entire sheet or change walking poses. No text, no grid, no props, no new anatomy.

## 骑行边缘修订

Use case: precise-object-edit. Clean this exact 4x4 riding sprite sheet for game integration. KEEP all 16 existing sprites and their slightly enlarged round bellies, original head/face size, green eyes, four directional rows FRONT/LEFT/RIGHT/BACK, arm and leg poses, blue cream scooters and all wheels. Keep original 1230x1278 dimensions and every sprite location unchanged.
ONLY remove thin stray red/green/yellow pixels and fuzzy halos OUTSIDE the solid brown creature outline or black scooter outline. Preserve actual yellow body and blue scooter colors INSIDE. Clean brown/black pixel outline, no bloom or shadow. Fill interiors fully opaque alpha255, empty background alpha0. Do not repaint anatomy, reduce belly, add motion, resize, crop, add text or change anything else.

## 结果说明

朝左第三帧腹斑已缩回较一致的位置。弱透明边缘仍未完全消除；主体多为 alpha253/255，接近不透明。骑行图的局部边缘更平滑，像素颗粒与运动连贯性仍属候选美术检查项。提示词不等于验收结果。

