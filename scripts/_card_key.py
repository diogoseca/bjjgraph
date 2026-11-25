"""A CARD'S KEY in content/ (CARD1-S2, v1.303.0; the owner's U220 a, "a short unique hash key").

Every player's progress on a flashcard (its grade, its schedule, its place among the decks that share it) is filed under
the card's KEY: its authored `id` when it carries one, else fnv1a32 of its question. A card whose question was never
reworded carries no `id`, and its key is its text's hash, as every key was before v1.303.0. Whatever rewords a question
writes `id: <the key of the text it replaces>` once, and the id never changes after: the card keeps its key, so nobody
loses it. The neural emitter carries the id to the wire as `k` (scripts/regenerate_neural_data.py `_card_key`); the app
keys a card by the same rule (`cardKey`, neural/src/app.src.jsx; `ngKnowledgeCardKey`, knowledge-profile.src.js).

Shared by scripts/check_card_keys.py (the gate), scripts/rewrite_questions.py and the content bot's `restore_questions`
(scripts/regenerate_content_json.py). The hash is the emitter's own (`_neural_content.fnv1a32`), never a copy.
"""
from __future__ import annotations

import re

from _neural_content import fnv1a32

CARD_ID = re.compile(r"^[0-9a-f]{8}$")


def is_card(c) -> bool:
    return isinstance(c, dict) and isinstance(c.get("question"), str)


def card_key(card: dict) -> str:
    """The card's key: its `id` when it is one (8 lowercase hex), else fnv1a32 of its question."""
    cid = card.get("id")
    return cid if isinstance(cid, str) and CARD_ID.match(cid) else fnv1a32(card["question"])


def flashcard_arrays(o, path=()):
    """Every flashcards array in a record, by its path: (path, list) for each key starting with "flashcards" whose value is
    a list, at any depth (the root, a role, a tier). The same walk as the content bot's `_flashcard_arrays`."""
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            if k.startswith("flashcards") and isinstance(v, list):
                out.append((path + (k,), v))
            else:
                out.extend(flashcard_arrays(v, path + (k,)))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            out.extend(flashcard_arrays(v, path + (i,)))
    return out


def array_faults(cards: list) -> list[str]:
    """What is wrong with the keys of ONE flashcards array (a deck as authored), each as a sentence:
      · an `id` that is not 8 lowercase hex digits;
      · one key held by two cards with DIFFERENT questions: a duplicate id, or an id equal to another live card's text
        hash. The app would merge the two cards' progress. (One key held by the same question twice is a question
        repeated in its deck, as before ids: they share progress by design.)"""
    out, by_key = [], {}
    for c in cards:
        if not is_card(c):
            continue
        cid = c.get("id")
        if cid is not None and not (isinstance(cid, str) and CARD_ID.match(cid)):
            out.append(f"id {cid!r} is not 8 lowercase hex digits (question {c['question'][:70]!r})")
            continue
        by_key.setdefault(card_key(c), []).append(c)
    for k, held in by_key.items():
        texts = sorted({c["question"] for c in held})
        if len(texts) > 1 and any(c.get("id") for c in held):
            out.append(f"key {k} is held by {len(texts)} different questions, so their progress would merge: "
                       + " | ".join(repr(t[:60]) for t in texts))
    return out


def pair_changes(old: list, new: list) -> dict:
    """Pair the cards of one flashcards array before and after an edit, and say which question changed without its key.

    A card is the same card when its KEY is unchanged (a reworded card that carries its id keeps it). Of the cards left on
    each side (an old key gone, a new key appeared), an old card and a new card WITHOUT an id are paired, in this order:
      0. the same question: its id was dropped or changed (`faults`);
      1. the same answer, a different question: reworded without its id (`faults`);
      2. the same place in the array: reworded with its answer, without its id (`faults`).
    A new card that carries an id of its own declares itself another card and is never paired. What is left is a card
    deleted (old) or added (new): both allowed, and counted.
    Returns {compared, kept, reworded, deleted, added, faults: [(old card, new card, why)]}."""
    ocards = [c for c in old if is_card(c)]
    ncards = [c for c in new if is_card(c)]
    nkeys = {}
    for j, c in enumerate(ncards):
        nkeys.setdefault(card_key(c), []).append(j)
    used = [False] * len(ncards)
    left = []
    kept = reworded = 0
    for i, oc in enumerate(ocards):
        k = card_key(oc)
        j = next((j for j in nkeys.get(k, []) if not used[j]), None)
        if j is None:
            left.append(i)
            continue
        used[j] = True
        kept += 1
        if ncards[j]["question"] != oc["question"]:
            reworded += 1
    faults = []
    # (rule, which new cards may pair, why): 0 sees every new card left (an id dropped OR changed on the same question);
    # 1 and 2 only a new card with no id (a card with an id of its own has declared itself another card)
    steps = ((lambda oc, nc, i, j: nc["question"] == oc["question"], lambda j: True, "its id was dropped or changed"),
             (lambda oc, nc, i, j: bool(oc.get("answer")) and nc.get("answer") == oc["answer"],
              lambda j: not ncards[j].get("id"), "its question was reworded without its id"),
             (lambda oc, nc, i, j: i == j, lambda j: not ncards[j].get("id"),
              "its question (and answer) were reworded without its id"))
    for rule, may, why in steps:
        rest = []
        for i in left:
            oc = ocards[i]
            j = next((j for j in range(len(ncards)) if not used[j] and may(j) and rule(oc, ncards[j], i, j)), None)
            if j is None:
                rest.append(i)
                continue
            used[j] = True
            faults.append((oc, ncards[j], why))
        left = rest
    added = sum(1 for j in range(len(ncards)) if not used[j])
    return {"compared": len(ocards), "kept": kept, "reworded": reworded, "deleted": len(left), "added": added,
            "faults": faults}
