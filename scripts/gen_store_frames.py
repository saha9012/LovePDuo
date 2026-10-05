"""Regenerate LovePDuo store marketing frames (1080x1920)."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "assets" / "store"
out.mkdir(parents=True, exist_ok=True)
W, H = 1080, 1920
BG = (7, 6, 10, 255)
AMBER = (226, 176, 122, 255)
ROSE = (227, 154, 160, 255)
TEXT = (247, 237, 227, 255)
MUTED = (201, 182, 168, 255)

try:
    f_big = ImageFont.truetype("arial.ttf", 92)
    f_mid = ImageFont.truetype("arial.ttf", 48)
    f_sm = ImageFont.truetype("arial.ttf", 34)
except Exception:
    f_big = f_mid = f_sm = ImageFont.load_default()


def base(title: str, sub: str, accent=AMBER):
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)
    for i in range(14, 0, -1):
        r = 80 + i * 55
        d.ellipse(
            [W // 2 - r - 40, 420 - r, W // 2 + r - 40, 420 + r],
            fill=(accent[0], accent[1], accent[2], 4 + i * 3),
        )
        d.ellipse(
            [W // 2 - r + 120, 900 - r, W // 2 + r + 120, 900 + r],
            fill=(ROSE[0], ROSE[1], ROSE[2], 3 + i * 2),
        )
    d.text((72, 160), "LovePDuo", fill=TEXT, font=f_big)
    d.text((76, 270), "Love Play Duo", fill=AMBER, font=f_sm)
    d.text((72, 420), title, fill=TEXT, font=f_mid)
    d.text((72, 500), sub, fill=MUTED, font=f_sm)
    d.rectangle([72, 360, 120, 366], fill=ROSE)
    d.rectangle([132, 360, 220, 366], fill=AMBER)
    return img, d


frames = [
    ("01_welcome.png", "Тёмная зона для двоих", "Янтарь · пыльная роза · два телефона", AMBER),
    ("02_pair.png", "Пара связана", "Код комнаты · cinematic pair link", ROSE),
    ("03_home.png", "Комната пары", "Presence · тепло · mood ночи", AMBER),
    ("04_sky_claim.png", "Sky Claim", "Лови огни. Комбо. Реванш.", AMBER),
    ("05_heartbeat.png", "Heartbeat Tap", "Ритм вдвоём · sync bonus", ROSE),
    ("06_music.png", "Полка пары", "Upload остаётся в LPD", AMBER),
    ("07_candle.png", "Together", "Свеча · заметки · искры", ROSE),
]

for name, title, sub, acc in frames:
    img, d = base(title, sub, acc)
    d.rounded_rectangle(
        [120, H - 280, W - 120, H - 180],
        radius=28,
        fill=(142, 59, 74, 220),
        outline=(226, 176, 122, 120),
        width=2,
    )
    d.text((W // 2 - 140, H - 250), "Играть вдвоём", fill=TEXT, font=f_mid)
    img.convert("RGB").save(out / name, quality=92)
    print("wrote", name)
