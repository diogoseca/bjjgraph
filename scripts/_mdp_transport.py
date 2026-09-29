"""Lossless worker-only table transport; never an addition to graph-data.json.

Records are topologically ordered JSON values. A primitive is itself; an array
contains record references; an object maps string-record references to value
references. Identical subtrees share one record. References are local to this
one transport, never action/state IDs. Decode before registering with the adapter.
Chunks stay below the existing 40,000-byte raw chunk ceiling. They are loaded
once, with bounded concurrency, and never re-sent with a choice-card request.
"""
import copy
import gzip
import hashlib
import json
from pathlib import Path

from _mdp_mechanics import stable

CODEC = "mdp-columns-v1"
CHUNK_BYTES = 39_000  # below the existing 40,000 B ceiling; no cap changes
NODE_COLUMNS = ("id", "t", "ty", "role", "fromRole", "pairId", "submissionId", "posId",
                "fromPositionId", "s", "dom", "allowed", "cal", "deckKey", "fallbackRole", "poolName")
OPTION_COLUMNS = ("techniqueId", "destinationId", "destinationRole", "kind", "defense", "relaxed", "ev")


def columns(value):
    """Omit redundant identity canonical rows, and remap IDs only within this wire.

    Definitions include their complete stable IDs; every reference is expanded
    before leaving this transport. This does not alter exported/action identities.
    """
    ns = value["nodes"]
    ids = {n["id"]: i for i, n in enumerate(ns)}

    def ref(nid):
        return None if nid is None else ids[nid]

    def key(k):
        nid, role = json.loads(k)
        return [ref(nid), role]

    nodes = []
    for n in ns:
        if set(n) != set(NODE_COLUMNS):
            raise ValueError("unknown-metadata-node-field")
        row = [n[k] for k in NODE_COLUMNS]
        for i in (5, 6):
            row[i] = ref(row[i])
        nodes.append(row)
    hands = []
    for k, options in sorted(value["hands"].items()):
        rows = []
        for o in options:
            if set(o) - set(OPTION_COLUMNS) - {"defenseId"}:
                raise ValueError("unknown-metadata-option-field")
            row = [o[x] for x in OPTION_COLUMNS]
            row[0], row[1] = ref(row[0]), ref(row[1])
            if "defenseId" in o:
                row.append(o["defenseId"])
            rows.append(row)
        hands.append([*key(k), rows])
    return {"header": {k: v for k, v in value.items() if k not in ("nodes", "hands", "canonical", "destinations", "evHands")},
            "nodes": nodes, "hands": hands,
            "canonical": [[*key(k), ref(v)] for k, v in sorted(value["canonical"].items()) if json.loads(k)[0] != v],
            "destinations": [[k, ref(v["nodeId"]), v["role"], v["terminal"]] for k, v in sorted(value["destinations"].items())],
            "evHands": [[*key(k), [[ref(r["techniqueId"]), r["att"], r["c1"]] for r in rows]] for k, rows in sorted(value["evHands"].items())]}


def expand_columns(value):
    ns = value["nodes"]

    def ref(i):
        if i is None:
            return None
        if not isinstance(i, int) or isinstance(i, bool) or not 0 <= i < len(ns):
            raise ValueError("invalid-node-reference")
        return ns[i][0]

    nodes = []
    for row in ns:
        if len(row) != len(NODE_COLUMNS):
            raise ValueError("invalid-node-columns")
        n = dict(zip(NODE_COLUMNS, row))
        n["pairId"], n["submissionId"] = ref(n["pairId"]), ref(n["submissionId"])
        nodes.append(n)
    hands = {}
    for idx, role, rows in value["hands"]:
        options = []
        for row in rows:
            if len(row) not in (len(OPTION_COLUMNS), len(OPTION_COLUMNS) + 1):
                raise ValueError("invalid-option-columns")
            o = dict(zip(OPTION_COLUMNS, row))
            o["techniqueId"], o["destinationId"] = ref(o["techniqueId"]), ref(o["destinationId"])
            if len(row) > len(OPTION_COLUMNS):
                o["defenseId"] = row[-1]
            options.append(o)
        hands[stable([ref(idx), role])] = options
    canonical = {stable([n["id"], role]): n["id"] for n in nodes for role in ("top", "bottom")}
    canonical.update({stable([ref(i), role]): ref(to) for i, role, to in value["canonical"]})
    return {**value["header"], "nodes": nodes, "hands": hands, "canonical": canonical,
            "destinations": {k: {"nodeId": ref(i), "role": role, "terminal": terminal} for k, i, role, terminal in value["destinations"]},
            "evHands": {stable([ref(i), role]): [{"techniqueId": ref(t), "att": att, "c1": c1} for t, att, c1 in rows] for i, role, rows in value["evHands"]}}


def pack(value):
    records, intern = [], {}

    def add(v):
        if isinstance(v, dict):
            encoded = {str(add(k)): add(v[k]) for k in sorted(v)}
        elif isinstance(v, list):
            encoded = [add(x) for x in v]
        else:
            encoded = v
        key = stable(encoded)
        if key not in intern:
            intern[key] = len(records)
            records.append(encoded)
        return intern[key]

    root = add(columns(value))
    return {"codec": CODEC, "root": root, "records": records}


def unpack(packed):
    if packed.get("codec") != CODEC:
        raise ValueError("unsupported-metadata-codec")
    values = []

    def ref(i):
        if not isinstance(i, int) or isinstance(i, bool) or not 0 <= i < len(values):
            raise ValueError("invalid-metadata-reference")
        return values[i]

    for r in packed["records"]:
        if isinstance(r, dict):
            decoded = {}
            for k, v in r.items():
                key = ref(int(k))
                if not isinstance(key, str) or key in decoded:
                    raise ValueError("invalid-metadata-key")
                decoded[key] = ref(v)
        elif isinstance(r, list):
            decoded = [ref(v) for v in r]
        else:
            decoded = r
        values.append(decoded)
    # Consumers treat registered metadata as immutable. The pure Python API returns
    # a copy so callers cannot accidentally alias separately decoded deliveries.
    return copy.deepcopy(expand_columns(ref(packed["root"])))


def compressed(data):
    # mtime=0 plus a fixed OS byte makes this independent of platform/wall clock.
    out = gzip.compress(data, compresslevel=9, mtime=0)
    return out[:9] + b"\xff" + out[10:]


def sizes(data):
    return {"rawBytes": len(data), "gzipBytes": len(compressed(data)), "sha256": hashlib.sha256(data).hexdigest()}


def atomic_write(path, data):
    path = Path(path)
    if path.exists() and path.read_bytes() == data:
        return
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def write_transport(output, metadata, chunk_bytes=CHUNK_BYTES):
    """Content-addressed parts, then descriptor; old artifacts remain preserved."""
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    packed = pack(metadata)
    parts = []
    # Split UTF-8 JSON text, including large map records. Each part is deliberately
    # .txt: it is a fragment, never independently parseable JSON. Join in manifest
    # order, verify transport SHA256, then JSON.parse once inside the worker.
    transport = stable(packed["records"]).encode()
    start = 0
    while start < len(transport):
        end = min(start + chunk_bytes, len(transport))
        while end < len(transport) and transport[end] & 0xC0 == 0x80:
            end -= 1
        if end == start:
            raise ValueError("chunk-budget-too-small")
        payload = transport[start:end]
        measured = sizes(payload)
        filename = "part-" + measured["sha256"] + ".txt"
        atomic_write(output / filename, payload)
        parts.append({"file": filename, **measured})
        start = end
    plain = stable(metadata).encode()
    return {"codec": CODEC, "partEncoding": "utf8-json-fragments", "root": packed["root"], "records": len(packed["records"]), "parts": parts,
            "decoded": sizes(plain), "transfer": {"rawBytes": sum(p["rawBytes"] for p in parts),
            "gzipBytes": sum(p["gzipBytes"] for p in parts), "requests": len(parts),
            "sha256": hashlib.sha256(transport).hexdigest(), "maxChunkBytes": max(p["rawBytes"] for p in parts)}}


def read_transport(output, descriptor):
    pieces = []
    for part in descriptor["parts"]:
        data = (Path(output) / part["file"]).read_bytes()
        if sizes(data) != {k: part[k] for k in ("rawBytes", "gzipBytes", "sha256")}:
            raise ValueError("metadata-part-integrity")
        pieces.append(data)
    joined = b"".join(pieces)
    if hashlib.sha256(joined).hexdigest() != descriptor["transfer"]["sha256"]:
        raise ValueError("metadata-transport-integrity")
    records = json.loads(joined)
    if len(records) != descriptor["records"]:
        raise ValueError("metadata-record-count")
    value = unpack({"codec": descriptor["codec"], "root": descriptor["root"], "records": records})
    if sizes(stable(value).encode()) != descriptor["decoded"]:
        raise ValueError("metadata-decoded-integrity")
    return value
