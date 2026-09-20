"""Shared guide integrity checks. Validation proves structure, never firsthand review."""
from datetime import date
from urllib.parse import urlsplit, parse_qs, unquote
import re


def canonical_course_url(value):
    """Reject tracked/placeholder source URLs instead of manufacturing a course match."""
    if not isinstance(value, str) or not value or re.search(r'\s|REPLACE_ME|[<>"\\]', unquote(value), re.I):
        return ''
    try:
        u = urlsplit(value)
        if u.scheme == 'https' and u.hostname and not (u.username or u.password or u.query or u.fragment):
            return value
    except ValueError:
        pass
    return ''


def preview_errors(preview):
    """Check player identity; playback preferences belong to the rendering surface."""
    errors = []
    try:
        u = urlsplit(preview.get('embed_url', ''))
        provider = preview.get('provider')
        valid = u.scheme == 'https' and not (u.username or u.password or u.fragment) and not re.search(r'\s', preview.get('embed_url', ''))
        if provider == 'youtube':
            valid &= u.netloc in ('www.youtube.com', 'www.youtube-nocookie.com') and bool(re.fullmatch(r'/embed/[A-Za-z0-9_-]{11}', u.path))
        elif provider == 'bunny':
            valid &= u.netloc in ('iframe.mediadelivery.net', 'player.mediadelivery.net') and bool(re.fullmatch(r'/embed/\d+/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}', u.path))
        else:
            valid = False
        if not valid:
            errors.append('guide.preview: exact official allowlisted player URL required')
    except (TypeError, ValueError):
        errors.append('guide.preview: invalid embed URL')
    return errors


def compact_preview(data):
    """Media needed before the full guide arrives; evidence remains in its dossier."""
    guide = data.get('guide') or {}
    preview = guide.get('preview')
    if not isinstance(preview, dict) or preview_errors(preview):
        return None
    if preview.get('kind') not in ('trailer', 'sample') or not isinstance(preview.get('title'), str) or not preview['title'].strip():
        return None
    source = next((s for s in guide.get('sources') or []
                   if isinstance(s, dict) and s.get('id') == preview.get('source_id')), {})
    if source.get('kind') not in ('official_listing', 'public_instruction'):
        return None
    return {field: preview[field] for field in ('provider', 'embed_url', 'title', 'kind')}


def validate_guide(data, content_root=None, emitted=False):
    """Return blocking integrity errors and review warnings after schema validation."""
    errors, warnings = [], []
    def inspect_urls(value):
        if isinstance(value, dict):
            for child in value.values(): inspect_urls(child)
        elif isinstance(value, list):
            for child in value: inspect_urls(child)
        elif isinstance(value, str):
            for raw in re.findall(r'https?://[^\s<>"\)]+', value):
                try:
                    url = urlsplit(raw)
                    keys = {k.lower() for k in parse_qs(url.query)}
                    if re.search('REPLACE_ME', unquote(raw), re.I) or keys & {'ref', 'rfsn'} or any(k.startswith('utm_') for k in keys):
                        errors.append('source URLs must not carry referrals or placeholders')
                except ValueError:
                    errors.append('invalid source URL')
    if not emitted:
        inspect_urls(data)
    for p in data.get('products') or []:
        if isinstance(p, dict) and not canonical_course_url(p.get('course_url')):
            errors.append('products: course_url must be canonical HTTPS without tracking or placeholders')
    guide = data.get('guide')
    if not isinstance(guide, dict):
        return errors, warnings  # schema reports a missing guide; legacy render remains supported
    sources = guide.get('sources') or []
    sources = [s for s in sources if isinstance(s, dict)]
    ids = [s.get('id') for s in sources]
    if len(ids) != len(set(ids)):
        errors.append('guide.sources: duplicate source id')
    by_id = {s.get('id'): s for s in sources}
    if 'start_here' in guide and not emitted:
        errors.append('guide.start_here is retired; remove reader homework rather than moving it')
    if not sources:
        if guide.get('kind') != 'topic_guide':
            errors.append('guide.sources: course companions require inspected primary sources')
        else:
            warnings.append('ROOT REVIEW: source-free topic guide must not invent technical instruction')
    if not emitted and guide.get('alternatives'):
        from pathlib import Path
        from _slug import slugify
        try:
            resolve_alternatives(guide['alternatives'], content_root or Path(__file__).resolve().parents[1] / 'content', slugify)
        except ValueError as exc:
            errors.append(str(exc))
    if emitted:
        for alternative in guide.get('alternatives') or []:
            if not isinstance(alternative, dict) or not all(isinstance(alternative.get(k), str) and alternative[k].strip() for k in ('system', 'reason', 'url', 'title')) or not alternative['url'].startswith('/Systems/'):
                errors.append('guide.alternatives: emitted comparison requires stable name, reason, local URL and title')
        for source in sources:
            if is_bjjfanatics_url(source.get('url')):
                canonical = source.get('canonical_url')
                if not is_bjjfanatics_url(canonical) or not isinstance(source.get('affiliate'), bool):
                    errors.append('guide.sources: emitted vendor source requires canonical_url and affiliate boolean')
                elif parse_qs(urlsplit(canonical).query).keys() & {'ref', 'rfsn'}:
                    errors.append('guide.sources: canonical_url carries tracking')
    preview = guide.get('preview')
    if isinstance(preview, dict):
        errors.extend(preview_errors(preview))
        source = by_id.get(preview.get('source_id'), {})
        if source.get('kind') not in ('official_listing', 'public_instruction'):
            errors.append('guide.preview: source_id must identify an official listing or public instruction')
    for item in sources + ([preview] if isinstance(preview, dict) else []):
        try:
            checked = date.fromisoformat(item.get('checked_on', ''))
            if checked > date.today():
                raise ValueError()
        except (TypeError, ValueError):
            errors.append('guide: checked_on must be an actual date, not in the future')
    return errors, warnings


def related_references(data, content_root, slug):
    """Resolve page references by real source files, never by an invented URL slug."""
    import json
    refs = []
    for item in data.get('related_content') or []:
        kind = item.get('content_type')
        folder = {'System': 'Systems', 'Principle': 'Principles'}.get(kind)
        if not folder:
            continue
        name = item.get('name', '')
        for path in sorted((content_root / folder).rglob('*.json')):
            source = json.loads(path.read_text())
            if name not in (path.stem, source.get('name'), *(source.get('aliases') or [])):
                continue
            rel = path.relative_to(content_root).with_suffix('')
            refs.append({'name': (source.get('guide') or {}).get('display_title') or name,
                         'source_name': source.get('name') or path.stem, 'type': kind,
                         'url': '/' + '/'.join(slug(p) for p in rel.parts),
                         'relationship': item.get('relationship', '')})
            break
    return refs


def is_bjjfanatics_url(value):
    try:
        u = urlsplit(value)
        return u.scheme == 'https' and u.netloc in ('bjjfanatics.com', 'www.bjjfanatics.com') and not (u.username or u.password)
    except (TypeError, ValueError):
        return False


def resolve_alternatives(alternatives, content_root, slug):
    """Exact stable source names only. Unknown/ambiguous comparisons block emission."""
    import json
    index = {}
    for path in sorted((content_root / 'Systems').rglob('*.json')):
        data = json.loads(path.read_text())
        name = data.get('name')
        if name in index:
            raise ValueError('guide.alternatives: duplicate stable System name')
        index[name] = (path, data)
    out, seen = [], set()
    for alternative in alternatives:
        name = alternative['system']
        if name not in index:
            raise ValueError(f'guide.alternatives: unknown exact System name {name!r}')
        if name in seen:
            raise ValueError(f'guide.alternatives: duplicate System {name!r}')
        seen.add(name)
        path, data = index[name]
        relative = path.relative_to(content_root).with_suffix('')
        out.append({'system': name, 'reason': alternative['reason'],
                    'url': '/' + '/'.join(slug(part) for part in relative.parts),
                    'title': (data.get('guide') or {}).get('display_title') or name})
    return out


def resolved_guide(data, content_root, slug):
    """Rich-only augmentation. Source checks/dates stay intact; never mutate input."""
    from copy import deepcopy
    guide = deepcopy(data.get('guide') or {})
    guide.pop('start_here', None)  # Legacy caches may survive; never emit rejected exercises.
    if 'alternatives' in guide:
        guide['alternatives'] = resolve_alternatives(guide['alternatives'], content_root, slug)
    for source in guide.get('sources') or []:
        if is_bjjfanatics_url(source.get('url')):
            source['canonical_url'] = source['url']
            source['affiliate'] = False
    return guide


def guide_relationship(item):
    """Remove stock per-reference qualifiers; leave specific authored context intact."""
    value = item.get('relationship', '').strip()
    kind = r'(?:position|transition|submission|technique|principle|system)'
    patterns = (
        rf'Related {kind} reference(?:; (?:graph linkage does not establish inclusion in the course|inclusion here does not establish course coverage))?\.?',
        rf'.+: related {kind} study, separate from the source syllabus\.?',
        rf'Related {kind} reference for (?:defensive decision|guard-recovery|leg-entanglement|positional escape|rear-mount escape|standing defense) study\.?',
        rf'Related {kind} reference for turtle defense and exits\.?',
        rf'Related {kind}(?: for orientation| on the graph)\.?',
        rf'Related BJJGraph {kind}\.?',
        r'Related position reference for comparing the course vocabulary\.?',
        r'Related concept for organizing study\.?',
        r'Related graph transition for separate study, not a verified course sequence\.?',
        r'Related Systems guide\.?',
        r'Related guide with a separate scope and source list\.?',
        r'Related study guide; its scope should be checked separately from this course\.?',
        rf'(?:Related {kind}(?: reference)?|Further conceptual reading|Related study guide): [^.!?]+\.?',
    )
    if any(re.fullmatch(pattern, value, re.I) for pattern in patterns):
        return ''
    names = {item.get('name', ''), item.get('source_name', '')}
    if any(name and re.fullmatch(rf'Related {kind} reference: {re.escape(name)}\.?', value, re.I) for name in names):
        return ''
    return value
