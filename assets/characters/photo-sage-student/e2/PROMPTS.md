# E2 图像生成记录

工具：内置 imagegen。参考图为用户已确认的 E1 character-views-v2.png。

## 步行首次生成

Use case: stylized-concept. Make a genuine four-direction WALK CYCLE sprite sheet for the SAME approved brown-haired girl in the attached reference sheet (use ONLY its standing top row for outfit/identity). This is an animation asset for CSU Pixel Campus, 2D pixel art.
Preserve brown wavy shoulder length hair with open forehead, gentle face, black long sleeve top with tiny lime-green marks, pale grey wide-leg trousers, white sneakers, sage crossbody bag at HER RIGHT HIP from HER LEFT SHOULDER. No new accessories; no handheld camera.
Output exactly 16 full-body sprites in a square image arranged as an EXACT 4x4 grid. Each cell equal size, plenty of transparent margins. ROW 1 facing front/screen down, ROW 2 facing screen left, ROW 3 facing screen right, ROW 4 back/screen up. Every row has FOUR DIFFERENT sequential gait frames: left foot forward with opposite arm forward, passing pose with feet near center, right foot forward with opposite arm, opposite passing pose. All four phases must be visibly distinct. Legs visibly alternate even with loose trousers; tiny natural hair/arm motion but stable face, torso size, hair length, shirt pattern, bag side. Feet make a clear walking stride, not just breathing or standing copies.
Alignment: each figure exactly centered in its cell on a fixed body vertical axis, same scale across all 16. Shared ground baseline at 92% of cell height, top of head about 10%; every foot fully contained. Match reference proportions around 3.5 heads tall, not excessively tiny body.
Asymmetry: never mirror left/right. In screen-left-facing row the bag is on hidden far right hip so no bag on the visible left hip. In screen-right-facing row the bag at the visible right hip is visible. Front bag on viewer-left, back bag on viewer-right.
Crisp chunky pixel clusters, limited palette, stepped pixel edges; no gradients, no anti-aliased halos. GENUINE TRANSPARENT PNG: empty pixels alpha 0, character interiors solid alpha 255. No colored backdrop, no glow, no shadows, no labels/grid/numbering. No vehicle anywhere in this walk sheet.

## 骑行首次生成

Use case stylized-concept. Make a 4-direction electric scooter RIDING animation sprite sheet of exactly the approved girl and sage/cream scooter from the BOTTOM ROW of reference. Same face, shoulder-length brown hair, black shirt with lime-green marks, light grey wide trousers, white sneakers, green crossbody bag from HER LEFT shoulder to HER RIGHT hip. No camera.
Exactly 16 full human-plus-scooter sprites in a SQUARE 4 columns by 4 rows evenly spaced grid. Rows in this strict order: front facing screen down, profile facing screen LEFT, profile facing screen RIGHT, rear facing screen UP. The 4 columns are 4 subtle sequential ride phases: wheels rotate by quarter increments (visible spoke/highlight movement), tiny hair tips move and sleeves vibrate, torso bob at most 1-2 source pixels; keep scooter body completely stable with identical wheelbase, wheel centers and tire ground line within every row. Each cell contains whole vehicle plus rider. Maximum sprite width 82% of cell, maximum height 80%, centered, transparent margins >=8%. Same rider head/body proportions across all rows. Absolutely no repeated identical static copies, no pedaling motion, both hands stay on handlebars and both feet on footboard. Front and rear feet tuck inward alongside scooter, never dangle outside.
Asymmetry must stay fixed: right-hip bag is on viewer left in front view, viewer right in rear view; in LEFT-facing profile bag is on far hip and not visible, in RIGHT-facing profile near-hip bag is visible. Do not mirror the girl. Copper strap buckle must stay consistent.
2D pixel art with crisp stepped edges, 3 tones per material, clean opaque interiors, no soft glow, no drop shadows, no gradients, no text, no labels, no grid lines. All sprites isolated on genuine fully TRANSPARENT alpha=0 background, character/scooter interior alpha=255. Do not reproduce any background or halo from reference. Keep exact approved design, no scenery.

## 步行 v2（增强侧向收腿）

Edit ONLY the WALK sprite sheet attached. Preserve 4x4 layout, square canvas, exact character design/colors, rows facing down/left/right/up, all full sprites and transparent background.
Required correction: the FOURTH sprite in the TOP ROW has its bag and shoulder strap mirrored. Fix ONLY this outfit asymmetry to match top row sprites 1-3: front-facing character has the bag at VIEWER LEFT hip and strap running from VIEWER RIGHT shoulder diagonally down to VIEWER LEFT hip, copper buckle on this strap. Her hair part and shirt neckline should stay consistent with sprites 1-3. The hand may swing but NEVER flip the outfit. Don't copy/mirror a whole frame.
Improve gait phase readability in each row: keep columns 1 and 3 as opposite foot contact phases (left foot leading vs right foot leading), columns 2 and 4 as the two passing phases with feet near the body axis. In the profiles specifically, columns 2 and 4 should have feet close together and one bent knee, rather than all 4 frames having a wide split stance. Keep bag fixed to anatomical right hip: visible in right-facing row, hidden in left-facing row, viewer right in back row.
Keep exact same scale in all frames, fixed torso center and grounded foot baseline per row; keep transparent gutters between rows. Crisp opaque pixel art, true alpha=0 background, no shadows or glow, no scene or words.

## 步行 v3（尝试修正包带，未成功，保留历史但不采用）

One localized costume correction ONLY. In the supplied 4 by 4 sprite sheet, change the crossbody bag and strap on the TOP RIGHT character (row 1 column 4). This character currently has the bag on the RIGHT side of the image; it MUST be on the LEFT side of this character in the image, just like the first three sprites in this row. Erase the current diagonal strap entirely and redraw it sloping from the upper RIGHT shoulder down to the lower LEFT hip, copper buckle on that strap and sage bag at lower LEFT hip. Do not mirror the person or change her pose. Her left-of-image arm can overlap the bag. Every other sprite unchanged. Keep identical canvas dimensions/layout, pixel art and transparent background.

当前 manifest 使用 walk-cycle-v2.png 与 ride-cycle.png。步行正面第 4 源帧因包带反向而排除，以第 2 源帧复用补足循环。未对 PNG 进行代码像素修改。

