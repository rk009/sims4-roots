"""Move release family memberships and twin settings to the new JSON format."""

import json
import re
from pathlib import Path


root = Path(__file__).resolve().parents[1] / "release"


def load(name):
    text = (root / name).read_text(encoding="utf-8")
    return json.loads(re.sub(r",(?=\s*[}\]])", "", text))


characters = load("characters.json")
families = load("families.json")
by_name = {character["characterName"]: character for character in characters}
added_members = 0
twins_moved = 0
for family in families:
    original_names = {member["characterName"] if isinstance(member, dict) else member for member in family["members"]}
    names = []
    for member in family["members"]:
        if isinstance(member, str):
            if member not in names:
                names.append(member)
            continue
        name = member["characterName"]
        if name not in names:
            names.append(name)
        character = by_name.get(name)
        if character is None:
            raise ValueError(f"Member missing from characters.json: {name}")
        if "twins" in member:
            if "twins" in character and character["twins"] != member["twins"]:
                raise ValueError(f"Conflicting twins for {name}")
            character["twins"] = member["twins"]
            twins_moved += 1
        for partner in member.get("partners", []):
            if partner.get("member") is True or partner.get("members") is True:
                partner_name = partner["characterName"]
                if partner_name not in by_name:
                    raise ValueError(f"Partner missing from characters.json: {partner_name}")
                if partner_name not in names and partner_name not in original_names:
                    names.append(partner_name)
                    added_members += 1
    family["members"] = names

for character in characters:
    for partner in character.get("partners", []):
        partner.pop("member", None)
        partner.pop("members", None)

assert all(isinstance(member, str) for family in families for member in family["members"])
assert all("twins" not in family for family in families)
(root / "characters.json").write_text(json.dumps(characters, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="")
(root / "families.json").write_text(json.dumps(families, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="")
print(f"Moved twins for {twins_moved} characters and added {added_members} family members")
