"""Add an explicit false death state to existing release characters."""

import json
import re
from pathlib import Path


path = Path(__file__).resolve().parents[1] / "release" / "characters.json"
original = path.read_text(encoding="utf-8")
characters = json.loads(original)
if any("isDead" in character for character in characters):
    raise ValueError("characters.json already contains isDead values")
updated, count = re.subn(
    r'^(    "star": (?:true|false),\n)',
    lambda match: match.group(1) + '    "isDead": false,\n',
    original,
    flags=re.MULTILINE,
)
if count != len(characters) or any(character.get("isDead") is not False for character in json.loads(updated)):
    raise ValueError("Could not add isDead to every character")
path.write_text(updated, encoding="utf-8", newline="")
print(f"Added isDead: false to {count} characters")
