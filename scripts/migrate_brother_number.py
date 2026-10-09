"""Move sibling order from release/conf/families.json to release/conf/characters.json."""

import json
import re
from pathlib import Path


root = Path(__file__).resolve().parents[1] / "release" / "conf"
family_path = root / "families.json"
character_path = root / "characters.json"
family_text = family_path.read_text(encoding="utf-8")
character_text = character_path.read_text(encoding="utf-8")


def parse(text):
    return json.loads(re.sub(r",(?=\s*[}\]])", "", text))


orders = {}
for family in parse(family_text):
    for member in family["members"]:
        number = member.get("brotherNumber")
        if number is None:
            continue
        name = member["characterName"]
        if name in orders and orders[name] != number:
            raise ValueError(f"Conflicting brotherNumber for {name}")
        orders[name] = number

characters = parse(character_text)
names = {character["characterName"] for character in characters}
if missing := orders.keys() - names:
    raise ValueError(f"Missing characters: {sorted(missing)}")
for character in characters:
    name = character["characterName"]
    if name in orders and "brotherNumber" in character and character["brotherNumber"] != orders[name]:
        raise ValueError(f"Conflicting character brotherNumber for {name}")

lines = []
for line in character_text.splitlines(keepends=True):
    lines.append(line)
    match = re.fullmatch(r'    "characterName": "([^"]+)",\n', line)
    if match and match.group(1) in orders:
        lines.append(f'    "brotherNumber": {orders[match.group(1)]},\n')
new_character_text = "".join(lines)
new_family_text = re.sub(r'^        "brotherNumber": \d+,\n', "", family_text, flags=re.MULTILINE)
assert sum("brotherNumber" in character for character in parse(new_character_text)) == len(orders)
assert all("brotherNumber" not in member for family in parse(new_family_text) for member in family["members"])
character_path.write_text(new_character_text, encoding="utf-8", newline="")
family_path.write_text(new_family_text, encoding="utf-8", newline="")
print(f"Moved brotherNumber for {len(orders)} characters")
