"""Regenerate LovePDuo store marketing frames (1080x1920)."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "assets" / "store"
out.mkdir(parents=True, exist_ok=True)
W, H = 1080, 1920
BG = (7, 6, 10, 255)
AMBER = (226, 176, 122, 255)
ROSE = (227, 154, 160, 255)
MIST = (156, 196, 196, 255)
TEXT = (247, 237, 227, 255)
MUTED = (201, 182, 168, 255)

try:
    f_brand = ImageFont.truetype("arial.ttf", 108)
    f_big = ImageFont.truetype("arial.ttf", 56)
    f_mid = ImageFont.truetype("arial.ttf", 40)
    f_sm = ImageFont.truetype("arial.ttf", 30)
except Exception:
    f_brand = f_big = f_mid = f_sm = ImageFont.load_default()


def vignette(d: ImageDraw.ImageDraw, accent):
    for i in range(18, 0, -1):
        r = 60 + i * 48
        d.ellipse(
            [W // 2 - r - 60, 380 - r, W // 2 + r - 60, 380 + r],
            fill=(accent[0], accent[1], accent[2], 3 + i * 2),
        )
        d.ellipse(
            [W // 2 - r + 140, 980 - r, W // 2 + r + 140, 980 + r],
            fill=(ROSE[0], ROSE[1], ROSE[2], 2 + i * 2),
        )


def phone_frame(d: ImageDraw.ImageDraw, x, y, w, h, glow=AMBER):
    d.rounded_rectangle([x - 8, y - 8, x + w + 8, y + h + 8], radius=48, fill=(glow[0], glow[1], glow[2], 28))
    d.rounded_rectangle([x, y, x + w, y + h], radius=42, fill=(18, 14, 24, 255), outline=(glow[0], glow[1], glow[2], 90), width=3)
    d.rounded_rectangle([x + 18, y + 48, x + w - 18, y + h - 36], radius=12, fill=(12, 10, 16, 255))
    d.ellipse([x + w // 2 - 28, y + 16, x + w // 2 + 28, y + 34], fill=(40, 34, 48, 255))


def base(title: str, sub: str, accent=AMBER, show_phones=False):
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)
    vignette(d, accent)
    d.text((72, 140), "LovePDuo", fill=TEXT, font=f_brand)
    d.text((76, 268), "Love Play Duo", fill=accent, font=f_sm)
    d.rectangle([72, 320, 118, 326], fill=ROSE)
    d.rectangle([130, 320, 220, 326], fill=accent)
    d.text((72, 360), title, fill=TEXT, font=f_big)
    d.text((72, 440), sub, fill=MUTED, font=f_sm)
    if show_phones:
        phone_frame(d, 180, 620, 300, 540, accent)
        phone_frame(d, 560, 700, 300, 540, ROSE)
        d.text((210, 900), "YOU", fill=MIST, font=f_sm)
        d.text((590, 980), "PAIR", fill=ROSE, font=f_sm)
    return img, d


frames = [
    ("01_welcome.png", "Тёмная зона для двоих", "Янтарь · пыльная роза · reconnect sync", AMBER, True),
    ("02_pair.png", "Пара связана", "Код · peer toast · cinematic pair link", ROSE, True),
    ("03_home.png", "Комната пары", "Presence · peer lobby · warmth · mood", AMBER, False),
    ("04_sky_claim.png", "Sky Claim", "Live score · combo notes · finish sync", AMBER, False),
    ("05_heartbeat.png", "Heartbeat Tap", "Miss HUD · sync bonus · rematch seed", ROSE, False),
    ("06_music.png", "Полка пары", "Upload cards dual · Spotify stub sync", AMBER, False),
    ("07_candle.png", "Together", "Свеча 15s sync · notes · hello", ROSE, False),
]

for name, title, sub, acc, phones in frames:
    img, d = base(title, sub, acc, phones)
    if not phones:
        # soft UI plate
        d.rounded_rectangle(
            [90, 640, W - 90, 1280],
            radius=36,
            fill=(22, 16, 30, 210),
            outline=(acc[0], acc[1], acc[2], 70),
            width=2,
        )
        d.text((130, 720), "LIVE PREVIEW FRAME", fill=MIST, font=f_sm)
        d.text((130, 800), title, fill=TEXT, font=f_mid)
        d.text((130, 880), "Replace with device capture", fill=MUTED, font=f_sm)
    d.rounded_rectangle(
        [120, H - 280, W - 120, H - 180],
        radius=28,
        fill=(142, 59, 74, 220),
        outline=(226, 176, 122, 120),
        width=2,
    )
    d.text((W // 2 - 160, H - 248), "Играть вдвоём", fill=TEXT, font=f_mid)
    img.convert("RGB").save(out / name, quality=92)
    print("wrote", name)

print("ok ->", out)
