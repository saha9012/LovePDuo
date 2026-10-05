import json
import re
from pathlib import Path

src = Path("apps/mobile/src/content/sparks.ts").read_text(encoding="utf-8")
pat = re.compile(
    r"\{ id: '([^']+)', kind: '([^']+)', filter: '([^']+)', text: '((?:\\'|[^'])*)' \}"
)
items = [
    {"id": a, "kind": b, "filter": c, "text": d.replace("\\'", "'")}
    for a, b, c, d in pat.findall(src)
]
out = Path("assets/content/sparks_ru.json")
out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"sparks {len(items)} -> {out}")
