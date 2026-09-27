# 左右步态修订提示词

工具：内置 imagegen。输入：原 E2 步行图、已确认 E1 外观。仅采用新图第二、第三行的移动帧，其余状态继续引用原图。

Edit this 4x4 pixel sprite sheet to FIX the SIDE WALK CYCLES in rows 2 and 3. Reference image 1 is the current defective animation sheet. Reference image 2 is approved character identity. Keep identical boy, fluffy black hair, round metal eyeglasses, olive green short sleeve shirt, charcoal pants, offwhite sneakers, crisp pixel style, same sprite size. Output exactly the same square 4 columns x 4 rows grid and 1254x1254 pixel size if possible.
Rows top to bottom remain front, left profile, right profile, back. Front and back are not the editing focus.
CRITICAL: existing side rows accidentally repeat the same front arm pose in all frames. REPLACE SIDE ROWS with a true four-phase anatomically alternating WALK CYCLE. Each side row must have FOUR DISTINCT silhouette poses with clear near-side arm and near-side leg movement. Keep the same near-side limbs across frames, subtly darker far-side limbs so their alternation is legible.
Row 2 all face screen LEFT:
Column 1: near arm swings BACK toward screen RIGHT, near leg extended FORWARD toward screen LEFT; far arm forward, far leg back. Two feet apart.
Column 2: near arm hangs vertically beside torso, near foot planted directly below hip, far knee passing forward, far heel raised. Narrow passing silhouette.
Column 3: near arm swings FORWARD toward screen LEFT, near leg extended BACK toward screen RIGHT; far arm back, far leg forward. This is the OPPOSITE of column 1, visibly different near arm and near knee.
Column 4: near arm hangs vertically, FAR foot planted below hip, NEAR knee lifted forward with near heel raised. Opposite passing phase of column 2.
Row 3 all face screen RIGHT:
Column 1: near arm back toward screen LEFT, near leg forward toward screen RIGHT.
Column 2: near arm vertical, near foot planted below hip, far knee passes forward.
Column 3: near arm forward toward screen RIGHT, near leg back toward screen LEFT.
Column 4: near arm vertical, far foot planted below hip, near knee passes forward.
Natural relaxed walk, no running, no reaching both hands forward, no shuffle, no repeated arm position. Hands alternate at hip level; elbows slightly bent, no waving. Neck, head, glasses and torso stay rigidly at identical positions within every cell of a row; pelvis height consistent, max 2px bob. Fixed foot ground baseline. Feet and hands complete with generous clear margins inside each cell, no cell crossing. Do not move the entire character sideways from frame to frame.
REAL transparent empty pixels alpha0; interiors fully opaque alpha255. No glow, no painted checkerboard, no shadow, no extra text or marks. Preserve first and fourth rows as closely as possible. Keep 4x4 grid.

