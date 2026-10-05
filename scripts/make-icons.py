# Placeholder icons for Spike (stdlib only). Replaced by real branding before V3.1 freeze.
import struct, zlib, os

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "editor", "src-tauri", "icons")
os.makedirs(OUT, exist_ok=True)

def png(w, h, rgb):
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))

def grub_glyph(w):
    # dark bg #1a1a1a with orange #ff9248 boot-entry bars
    bg, fg = (26, 26, 26), (255, 146, 72)
    px = []
    for y in range(w):
        row = []
        for x in range(w):
            bar = (y % (w // 4)) < (w // 12) and x > w // 4 and x < 3 * w // 4
            row.append(fg if bar else bg)
        px.append(row)
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in px)
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, w, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))

p32 = grub_glyph(32)
p128 = grub_glyph(128)
open(os.path.join(OUT, "32x32.png"), "wb").write(p32)
open(os.path.join(OUT, "128x128.png"), "wb").write(p128)
open(os.path.join(OUT, "128x128@2x.png"), "wb").write(p128)

# Vista+ ICO: entries embed PNG data directly
def ico(images):
    n = len(images)
    head = struct.pack("<HHH", 0, 1, n)
    off = 6 + 16 * n
    body = b""
    dirs = b""
    for (w, data) in images:
        dirs += struct.pack("<BBBBHHII", w % 256, w % 256, 0, 0, 1, 32, len(data), off)
        off += len(data)
        body += data
    return head + dirs + body

open(os.path.join(OUT, "icon.ico"), "wb").write(ico([(32, p32), (128, p128)]))
print("icons written to", OUT)
