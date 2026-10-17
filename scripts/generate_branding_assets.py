import os
from PIL import Image, ImageFilter
import numpy as np
from collections import deque

src_path = r"C:/Users/Kyaw Zay Ya Hein/.gemini/antigravity/brain/449aad46-01fb-4349-97fd-48fc17d85262/.user_uploaded/media_1792247571109_a930c4fd.jpg"
out_dir = r"D:\Project\TrustedMarketplace\frontend\public\images\branding"
public_dir = r"D:\Project\TrustedMarketplace\frontend\public"
app_dir = r"D:\Project\TrustedMarketplace\frontend\src\app"

os.makedirs(out_dir, exist_ok=True)

img = Image.open(src_path).convert("RGB")
arr = np.array(img, dtype=np.float32)
h, w, _ = arr.shape

bg_color = np.array([251.0, 247.0, 238.0], dtype=np.float32)
dist = np.linalg.norm(arr - bg_color, axis=-1)

# Floodfill from borders to find outer background
is_bg = np.zeros((h, w), dtype=bool)
visited = np.zeros((h, w), dtype=bool)
q = deque()

for x in range(w):
    q.append((0, x))
    q.append((h - 1, x))
    visited[0, x] = True
    visited[h - 1, x] = True
for y in range(h):
    q.append((y, 0))
    q.append((y, w - 1))
    visited[y, 0] = True
    visited[y, w - 1] = True

while q:
    y, x = q.popleft()
    if dist[y, x] < 22.0:
        is_bg[y, x] = True
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                if dist[ny, nx] < 22.0:
                    q.append((ny, nx))

# Handle enclosed counters in letters like 'a' and 'd' for full transparent logo
# By identifying isolated background regions below row 630
counter_visited = is_bg.copy()
for y in range(630, 830):
    for x in range(w):
        if not counter_visited[y, x] and dist[y, x] < 15.0:
            # Check if this region is background inside text
            region = []
            cq = deque([(y, x)])
            counter_visited[y, x] = True
            is_enclosed_bg = True
            while cq:
                cy, cx = cq.popleft()
                region.append((cy, cx))
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        if not counter_visited[ny, nx]:
                            counter_visited[ny, nx] = True
                            if dist[ny, nx] < 15.0:
                                cq.append((ny, nx))
                    else:
                        is_enclosed_bg = False
            # Only treat small enclosed holes in letters as transparent
            if is_enclosed_bg and len(region) < 2500:
                for ry, rx in region:
                    is_bg[ry, rx] = True

# Create smooth alpha channel
alpha = np.ones((h, w), dtype=np.uint8) * 255
alpha[is_bg] = 0

# Smooth alpha edges slightly
alpha_img = Image.fromarray(alpha, mode="L")
alpha_smooth = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.7))

# Build RGBA image
rgba_arr = np.dstack([np.array(img), np.array(alpha_smooth)])
full_transparent = Image.fromarray(rgba_arr, mode="RGBA")

# Save full transparent and cream versions
full_transparent.save(os.path.join(out_dir, "matchguard-full-transparent.png"), "PNG")
img.save(os.path.join(out_dir, "matchguard-full-cream.png"), "PNG")

# Extract emblem: rows 175 to 635, cols 310 to 715
emblem_box = (310, 175, 715, 635)
emblem_crop = full_transparent.crop(emblem_box)

# Place into square 512x512 canvas with nice margin
ew, eh = emblem_crop.size
target_size = 512
margin = 32
scale = (target_size - 2 * margin) / max(ew, eh)
new_w = int(round(ew * scale))
new_h = int(round(eh * scale))
emblem_resized = emblem_crop.resize((new_w, new_h), Image.Resampling.LANCZOS)

square_emblem = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
offset_x = (target_size - new_w) // 2
offset_y = (target_size - new_h) // 2
square_emblem.paste(emblem_resized, (offset_x, offset_y), emblem_resized)

# Save standard icons in branding dir
square_emblem.save(os.path.join(out_dir, "matchguard-icon-512.png"), "PNG")

icon_192 = square_emblem.resize((192, 192), Image.Resampling.LANCZOS)
icon_192.save(os.path.join(out_dir, "matchguard-icon-192.png"), "PNG")

icon_180 = square_emblem.resize((180, 180), Image.Resampling.LANCZOS)
icon_180.save(os.path.join(out_dir, "apple-touch-icon.png"), "PNG")

icon_64 = square_emblem.resize((64, 64), Image.Resampling.LANCZOS)
icon_64.save(os.path.join(out_dir, "matchguard-icon-64.png"), "PNG")

icon_32 = square_emblem.resize((32, 32), Image.Resampling.LANCZOS)
icon_32.save(os.path.join(out_dir, "favicon-32x32.png"), "PNG")

icon_16 = square_emblem.resize((16, 16), Image.Resampling.LANCZOS)
icon_16.save(os.path.join(out_dir, "favicon-16x16.png"), "PNG")

# Generate multi-size favicon.ico
square_emblem.save(
    os.path.join(out_dir, "favicon.ico"),
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
)

# Also copy primary icons directly to public/ and app/ for Next.js convention & PWA
for dest in [public_dir, app_dir]:
    square_emblem.save(os.path.join(dest, "icon.png"), "PNG")
    icon_180.save(os.path.join(dest, "apple-icon.png"), "PNG")
    square_emblem.save(
        os.path.join(dest, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

icon_180.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
icon_192.save(os.path.join(public_dir, "icon-192.png"), "PNG")
square_emblem.save(os.path.join(public_dir, "icon-512.png"), "PNG")

print("All raster branding assets generated successfully!")
