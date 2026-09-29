"""Learning's complete reading contract across authored source, dossiers and static pages."""
import copy
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import regenerate_neural_data as neural
import regenerate_md_from_json as pages
from _learning import reading_index, related_readings
from _neural_content import fnv1a32
from regenerate_graph import quartz_slug


def fixture():
    return {
        "name": "Stable Learning Name",
        "display_title": "A clearer reading title",
        "description": "A" * 150,
        "summary": "Choose an action from the position you can actually control.",
        "tags": ["bjj", "learning", "training"],
        "category": "Training",
        "overview": "Notice the partner's response before deciding whether to continue or reset.",
        "key_takeaways": [f"Takeaway {i}: stay aware of the available space." for i in range(4)],
        "bjj_applications": [{"scenario": f"Scenario {i}", "application": f"Application {i}: move around the frame.",
                              "outcome": f"Outcome {i}: look for a changed angle."} for i in range(3)],
        "common_mistakes": [{"mistake": f"Mistake {i}", "consequence": f"Consequence {i}: losing the connection.",
                             "correction": f"Correction {i}: recover the inside position."} for i in range(3)],
        "training_exercises": [{"name": f"Exercise {i}", "description": "Start seated with a partner standing. Recover an inside frame, then reset once the partner clears both knees.",
                                "focus": f"Focus {i}: notice the frame before moving."} for i in range(2)],
        "knowledge_assessment": [{"question": "What changes after the partner closes the space?",
                                  "answer": "Recover a frame before trying to move through the occupied space."}],
        "related_content": [{"name": name, "content_type": kind, "relationship": "A separate reading question."}
                            for name, kind in [("Frames", "Principle"), ("Target Guide", "System"), ("Next Article", "Learning")]],
        "references": [{"title": "Source title", "author": "Source author", "url": "https://example.org/source"}],
    }


class ReaderHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.section = None
        self.details = []
        self.preview_counts = {}
        self.text = []
        self.in_script = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "section":
            self.section = attrs.get("id")
        if tag == "script":
            self.in_script = True
        if tag == "details":
            self.details.append(attrs)
        if self.section and not self.details and (tag == "li" or tag == "div"):
            self.preview_counts[self.section] = self.preview_counts.get(self.section, 0) + 1

    def handle_endtag(self, tag):
        if tag == "section":
            self.section = None
        if tag == "script":
            self.in_script = False
        if tag == "details":
            self.details.pop()

    def handle_data(self, data):
        if not self.in_script:
            self.text.append(data)


class LearningSchema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / "templates/Learning.json").read_text())
        jsonschema.Draft7Validator.check_schema(cls.schema)
        cls.validator = jsonschema.Draft7Validator(cls.schema)

    def test_practical_short_article_and_optional_assessment(self):
        data = fixture()
        self.assertFalse(list(self.validator.iter_errors(data)))
        del data["knowledge_assessment"]
        del data["display_title"]
        self.assertFalse(list(self.validator.iter_errors(data)))
        data["knowledge_assessment"] = []
        self.assertFalse(list(self.validator.iter_errors(data)))

    def test_padding_and_excess_sections_are_rejected_at_authoring(self):
        for key, value in [("overview", "x" * 451), ("summary", "x" * 261),
                           ("key_takeaways", ["A useful takeaway."] * 6),
                           ("knowledge_assessment", fixture()["knowledge_assessment"] * 5)]:
            data = fixture()
            data[key] = value
            self.assertTrue(list(self.validator.iter_errors(data)), key)

    def test_all_authored_learning_is_structured_and_within_editorial_limits(self):
        folder = ROOT / "content/Learning"
        sources = sorted(folder.glob("*.json"))
        self.assertGreaterEqual(len(sources), 26)
        for path in sources:
            with self.subTest(article=path.stem):
                data = json.loads(path.read_text())
                self.assertEqual(data["name"], path.stem)
                self.assertFalse(list(self.validator.iter_errors(data)))
        self.assertEqual([p.name for p in folder.glob("*.md") if not p.with_suffix(".json").exists()], [])


class LearningEmission(unittest.TestCase):
    def test_full_text_outcomes_and_optional_reader_fields_survive(self):
        data = fixture()
        data["training_exercises"][0]["description"] = "Practice detail. " * 40 + "KEEP THE LAST SENTENCE."
        data["bjj_applications"][0]["application"] = "Relevant detail. " * 35 + "FINAL APPLICATION."
        before = copy.deepcopy(data)
        body = neural._concept_body(data, "Learning")
        self.assertEqual(body["drills"][0]["how"], data["training_exercises"][0]["description"])
        self.assertEqual(body["contexts"][0]["how"], data["bjj_applications"][0]["application"])
        self.assertEqual(body["contexts"][0]["outcome"], data["bjj_applications"][0]["outcome"])
        self.assertEqual(body["assessment"], data["knowledge_assessment"])
        self.assertEqual(body["references"], data["references"])
        self.assertEqual(data, before)
        del data["knowledge_assessment"]
        del data["references"]
        body = neural._concept_body(data, "Learning")
        self.assertEqual(body["assessment"], [])
        self.assertEqual(body["references"], [])

    def test_real_typed_links_editorial_titles_and_canonical_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            content = root / "content"
            for folder in ("Learning", "Principles", "Systems"):
                (content / folder).mkdir(parents=True)
            data = fixture()
            (content / "Learning/Stable Learning Name.json").write_text(json.dumps(data))
            (content / "Learning/Next Article.json").write_text(json.dumps({**fixture(), "name": "Next Article", "display_title": "Next question", "related_content": []}))
            (content / "Principles/Frames.json").write_text(json.dumps({"name": "Frames"}))
            (content / "Systems/Target Guide.json").write_text(json.dumps({"name": "Target Guide", "guide": {"display_title": "A focused guide"}}))
            libraries = (("Principle", "Principles", content / "Principles"), ("Learning", "Learning", content / "Learning"))
            with patch.object(neural, "ROOT", root), patch.object(neural, "CONCEPT_LIBS", libraries), patch.object(neural, "load_ordinals", return_value={}):
                index, bodies = neural.build_concepts([])
                row = next(c for c in index["concepts"] if c["name"] == data["name"])
                self.assertEqual(row["title"], data["display_title"])
                self.assertEqual(row["id"], "Learning/Stable-Learning-Name")
                self.assertEqual(row["key"], "Stable Learning Name|Learning")
                self.assertEqual(row["url"], "/Learning/Stable-Learning-Name")
                for field in ("contexts", "assessment", "references", "relatedReadings", "overview"):
                    self.assertNotIn(field, row)
                body = bodies[row["key"]]
                self.assertEqual(body["relatedReadings"], [
                    {"id": "Principles/Frames", "cat": "Principle", "title": "Frames", "url": "/Principles/Frames"},
                    {"id": "Systems/Target-Guide", "cat": "System", "title": "A focused guide", "url": "/Systems/Target-Guide"},
                    {"id": "Learning/Next-Article", "cat": "Learning", "title": "Next question", "url": "/Learning/Next-Article"},
                ])
                self.assertEqual(body["related"], ["Principles/Frames", "Learning/Next-Article"])
                data["related_content"][1]["name"] = "Systems/Target-Guide"
                (content / "Learning/Stable Learning Name.json").write_text(json.dumps(data))
                _, bodies = neural.build_concepts([])
                self.assertEqual(bodies[row["key"]]["relatedReadings"][1]["id"], "Systems/Target-Guide")
                data["related_content"][1]["name"] = "Missing guide"
                (content / "Learning/Stable Learning Name.json").write_text(json.dumps(data))
                with self.assertRaisesRegex(ValueError, "unresolved related reading: Missing guide"):
                    neural.build_concepts([])


class LearningStatic(unittest.TestCase):
    def render(self, data):
        return pages.load_template("Learning", "Learning.md.jinja2").render(
            **data, reading_links=[{"title": "A focused guide", "url": "/Systems/Target-Guide"}], resolve=lambda name: name)

    def test_frontmatter_preserves_tags_for_quartz_tag_routes(self):
        # The three migrated beginner guides used to carry handwritten frontmatter.
        # Losing their tags silently removes /tags/beginner from the Quartz build.
        data = fixture()
        data["tags"] = ["learning", "beginner", "label: with # punctuation"]
        frontmatter = self.render(data).split("---", 2)[1]
        tags = re.search(r"^tags: (.+)$", frontmatter, re.M)
        self.assertIsNotNone(tags, "Quartz needs tags in the generated frontmatter")
        # JSON arrays are valid YAML flow sequences; punctuation must remain quoted.
        self.assertEqual(json.loads(tags.group(1)), data["tags"])

    def test_native_previews_complete_content_and_safe_structured_data(self):
        data = fixture()
        data["display_title"] = 'Questions & "answers" <today>'
        data["overview"] = 'Notice <script>alert("unsafe")</script> & keep reading.'
        text = self.render(data)
        parser = ReaderHTML()
        parser.feed(text)
        self.assertEqual(parser.preview_counts["key-takeaways"], 3)
        self.assertEqual(parser.preview_counts["applications"], 2)
        self.assertEqual(parser.preview_counts["mistakes"], 2)
        self.assertEqual(parser.preview_counts["exercises"], 1)
        self.assertNotIn('<script>alert("unsafe")</script>', text)
        self.assertIn(html.escape(data["overview"]).replace("&#x27;", "&#39;").replace("&quot;", "&#34;"), text)
        readable = "".join(parser.text)
        for item in data["bjj_applications"]:
            self.assertIn(item["outcome"], readable)
        self.assertIn(data["training_exercises"][-1]["description"], readable)
        self.assertIn(data["knowledge_assessment"][0]["answer"], readable)
        self.assertNotRegex(text, r"<details[^>]*\sopen(?:\s|>)")
        schemas = [json.loads(s) for s in re.findall(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', text, re.S)]
        article = next(s for s in schemas if s["@type"] == "Article")
        self.assertEqual(article["name"], data["display_title"])
        self.assertEqual(article["url"], "https://bjjgraph.org/Learning/Stable-Learning-Name")
        self.assertEqual(next(s for s in schemas if s["@type"] == "DefinedTerm")["description"], data["summary"])

    def test_empty_optional_sections_are_absent_and_title_falls_back(self):
        data = fixture()
        for key in ("display_title", "knowledge_assessment", "references"):
            del data[key]
        text = self.render(data)
        self.assertIn('title: "Stable Learning Name | BJJ Learning | BJJ Graph"', text)
        for absent in ('id="self-assessment"', 'id="sources"', '"@type": "FAQPage"'):
            self.assertNotIn(absent, text)


class LearningPublishedWire(unittest.TestCase):
    def test_every_source_sentence_is_in_its_deferred_dossier(self):
        folder = ROOT / "source/quartz/static/neural"
        index = json.loads((folder / "concepts.json").read_text())
        rows = {row["name"]: row for row in index["concepts"] if row["cat"] == "Learning"}
        sources = sorted((ROOT / "content/Learning").glob("*.json"))
        self.assertEqual(set(rows), {path.stem for path in sources})
        self.assertFalse([page for page in index["_meta"]["mdOnlyPages"] if page.startswith("Learning/")])
        readings = reading_index(ROOT / "content", quartz_slug)
        for path in sources:
            with self.subTest(article=path.stem):
                source = json.loads(path.read_text())
                row = rows[path.stem]
                self.assertEqual(row.get("title", row["name"]), source.get("display_title", source["name"]))
                self.assertEqual(row["summary"], source["summary"])
                self.assertEqual(row["key"], source["name"] + "|Learning")
                self.assertEqual(row["url"], "/Learning/" + quartz_slug(path.stem))
                chunk = json.loads((folder / "content" / (fnv1a32(row["key"]) + ".json")).read_text())
                body = chunk[row["key"]]
                self.assertEqual(body["overview"], source["overview"])
                self.assertEqual(body["points"], source["key_takeaways"])
                self.assertEqual(body["contexts"], [{"c": x["scenario"], "how": x["application"], "outcome": x["outcome"]} for x in source["bjj_applications"]])
                self.assertEqual(body["errors"], [{"err": x["mistake"], "why": x["consequence"], "fix": x["correction"]} for x in source["common_mistakes"]])
                self.assertEqual(body["drills"], [{"name": x["name"], "how": x["description"], "focus": x["focus"]} for x in source["training_exercises"]])
                self.assertEqual(body["assessment"], [{"question": x["question"], "answer": x["answer"]} for x in source.get("knowledge_assessment", [])])
                self.assertEqual(body["references"], source.get("references", []))
                links, unresolved = related_readings(source, readings)
                self.assertFalse(unresolved)
                self.assertEqual(body["relatedReadings"], [link for link in links if link["id"] != row["id"]])


if __name__ == "__main__":
    unittest.main()
