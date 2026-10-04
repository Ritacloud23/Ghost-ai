import re

_CARDINALITY_RE = re.compile(r"^[1nm]\s*[:\-]\s*[1nm]$", re.IGNORECASE)


def _snake(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(text).strip().lower()).strip("_")


def _singular(name: str) -> str:
    if name.endswith("ies") and len(name) > 3:
        return name[:-3] + "y"
    if name.endswith("s") and not name.endswith("ss"):
        return name[:-1]
    return name


def _parent_for(column_name: str, tables: list[dict], own_id: str) -> dict | None:
    """The table a foreign key column points to, guessed from its name (lease_id -> leases)."""
    name = _snake(column_name)
    if not name.endswith("_id"):
        return None
    base = name[:-3]
    if not base:
        return None
    for table in tables:
        if table["id"] == own_id:
            continue
        label = _snake(table.get("label", ""))
        if base in (label, _singular(label)):
            return table
    return None


def link_entities(design: dict | None) -> dict | None:
    """Return the design with its table-to-table lines matched to the foreign keys.

    Only plain ER diagrams (every shape is a table) are changed.
    """
    if not design:
        return design

    shapes = design.get("shapes") or []
    edges = list(design.get("edges") or [])
    tables = [s for s in shapes if s.get("type") == "entity"]
    if len(tables) < 2 or len(tables) != len(shapes):
        return design

    by_id = {t["id"]: t for t in tables}

    # For each table: which tables its foreign keys point to, and whether it has
    # a foreign key we could not match to any table (for example owner_id -> users).
    parents_of: dict[str, set[str]] = {t["id"]: set() for t in tables}
    unmatched: set[str] = set()
    for table in tables:
        for col in table.get("columns") or []:
            if col.get("key") != "fk":
                continue
            parent = _parent_for(col.get("name", ""), tables, table["id"])
            if parent is not None:
                parents_of[table["id"]].add(parent["id"])
            else:
                unmatched.add(table["id"])

    # No foreign keys at all: keep exactly what the AI drew.
    if not any(parents_of.values()) and not unmatched:
        return design

    kept: list[dict] = []
    seen: set[tuple[str, str]] = set()  # (parent id, child id)

    # 1. Keep the AI's lines that a foreign key backs, pointing from parent to child.
    for edge in edges:
        a, b = edge.get("from"), edge.get("to")
        if a not in by_id or b not in by_id or a == b:
            continue

        if a in parents_of[b]:  # b has a foreign key to a: a is the parent
            pair, line = (a, b), edge
        elif b in parents_of[a]:  # reversed: a has the foreign key, so flip the line
            pair, line = (b, a), {**edge, "from": b, "to": a}
        elif b in unmatched:  # b has a foreign key we could not place: trust the AI
            pair, line = (a, b), edge
        elif a in unmatched:
            pair, line = (b, a), {**edge, "from": b, "to": a}
        else:
            continue  # no foreign key backs this line

        if pair in seen:
            continue
        seen.add(pair)
        kept.append(line)

    # 2. Add a line for every foreign key that has none yet.
    used_ids = {str(e.get("id")) for e in kept}
    counter = 1
    for table in tables:
        for parent_id in sorted(parents_of[table["id"]]):
            pair = (parent_id, table["id"])
            if pair in seen:
                continue
            seen.add(pair)
            while f"fk{counter}" in used_ids:
                counter += 1
            line_id = f"fk{counter}"
            used_ids.add(line_id)
            kept.append({"id": line_id, "from": parent_id, "to": table["id"], "label": "1:N"})

    # 3. Every line between tables gets a relationship label like 1:N.
    for line in kept:
        label = str(line.get("label") or "").strip()
        if not _CARDINALITY_RE.match(label):
            line["label"] = "1:N"

    return {**design, "edges": kept}