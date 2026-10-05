# Placeholder icons for Spike (stdlib only). Replaced by real branding before V3.1 freeze.
#
# DO NOT DOWNGRADE TO RGB: tauri's generate_context! (Linux macro path) requires
# icons/icon.png to be RGBA (PNG color type 6). The Windows-only .ico path is laxer,
# but Linux is not — saving 25% bytes by dropping alpha re-breaks `tauri build`
# (proven twice by CI: missing icon.png, then non-RGBA icon.png).
# This holds regardless of bundle.active:false (it skips packaging, not icon checks).
import struct, sys, zlib, os

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "editor", "src-tauri", "icons")

ALLOWED_SQUARE_SIDES = {16, 32, 48, 64, 128, 256, 512, 1024}


def chunk(t, d):
    c = t + d
    return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)


def grub_glyph_rgba(w):
    # dark bg #1a1a1a with orange #ff9248 boot-entry bars, fully opaque.
    bg, fg = (26, 26, 26, 255), (255, 146, 72, 255)
    raw = b"".join(
        b"\x00" + b"".join(
            bytes(fg if ((y % (w // 4)) < (w // 12) and w // 4 < x < 3 * w // 4) else bg)
            for x in range(w)
        )
        for y in range(w)
    )
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, w, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))


def read_ihdr(path):
    """Return (width, height, bit_depth, color_type) from a PNG file."""
    with open(path, "rb") as f:
        data = f.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{path}: bad PNG signature"
    pos = 8
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        if ctype == b"IHDR":
            w, h, depth, ctype_n, comp, filt, inter = struct.unpack(">IIBBBBB", data[pos + 8:pos + 21])
            return w, h, depth, ctype_n
        pos += 12 + length
    raise AssertionError(f"{path}: IHDR not found")


def verify():
    """CI gate: every icons/* PNG must be square RGBA in the allowed size set;
    icon.ico entries must embed PNG (Vista+ style), each RGBA as well."""
    failures = []
    for name in sorted(os.listdir(OUT)):
        if not name.endswith(".png"):
            continue
        p = os.path.join(OUT, name)
        w, h, depth, ctype = read_ihdr(p)
        ok = w == h and w in ALLOWED_SQUARE_SIDES and depth == 8 and ctype == 6
        print(f"{name}: {w}x{h} depth={depth} colortype={ctype} -> {'OK' if ok else 'FAIL'}")
        if not ok:
            failures.append(name)
    ico = os.path.join(OUT, "icon.ico")
    with open(ico, "rb") as f:
        blob = f.read()
    assert blob[:4] == b"\x00\x00\x01\x00", "icon.ico: bad header"
    (n,) = struct.unpack("<H", blob[4:6])
    off = 6
    for _ in range(n):
        size, img_off = struct.unpack("<II", blob[off + 8:off + 16])
        entry = blob[img_off:img_off + size]
        if entry[:8] != b"\x89PNG\r\n\x1a\n":
            failures.append("icon.ico: non-PNG (BMP) entry found")
            break
        off += 16
    else:
        print(f"icon.ico: {n} PNG entries -> OK")
    if failures:
        raise SystemExit(f"ICON VERIFY FAILED: {failures}")
    print("ICON VERIFY PASSED")


def generate():
    os.makedirs(OUT, exist_ok=True)
    p32 = grub_glyph_rgba(32)
    p128 = grub_glyph_rgba(128)
    p512 = grub_glyph_rgba(512)
    open(os.path.join(OUT, "32x32.png"), "wb").write(p32)
    open(os.path.join(OUT, "128x128.png"), "wb").write(p128)
    open(os.path.join(OUT, "128x128@2x.png"), "wb").write(p128)
    # tauri-build generate_context! hard-requires icons/icon.png even with
    # bundle.active:false (proven by Linux CI). .icns deferred to V3.1 real branding.
    open(os.path.join(OUT, "icon.png"), "wb").write(p512)

    # Vista+ ICO: entries embed PNG data directly (NOT BMP), so RGBA applies here too.
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


if __name__ == "__main__":
    if "--verify" in sys.argv:
        verify()
    else:
        generate()
        verify()
