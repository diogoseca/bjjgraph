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
    errors = []
    try:
        u = urlsplit(preview.get('embed_url', ''))
        q = parse_qs(u.query)
        provider = preview.get('provider')
        valid = u.scheme == 'https' and not (u.username or u.password or u.fragment)
        if provider == 'youtube':
            valid &= u.netloc in ('www.youtube.com', 'www.youtube-nocookie.com') and bool(re.fullmatch(r'/embed/[A-Za-z0-9_-]{11}', u.path))
            valid &= q.get('autoplay') == ['0']
        elif provider == 'bunny':
            valid &= u.netloc == 'iframe.mediadelivery.net' and bool(re.fullmatch(r'/embed/\d+/[a-fA-F0-9-]{36}', u.path))
            valid &= q.get('autoplay') == ['false'] and q.get('preload') == ['false']
        else:
            valid = False
        if not valid:
            errors.append('guide.preview: official allowlisted player required with autoplay/preload disabled')
    except ValueError:
        errors.append('guide.preview: invalid embed URL')
    return errors


def validate_guide(data):
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
                    if re.search('REPLACE_ME', unquote(raw), re.I) or keys & {'ref', 'rfsn'}:
                        errors.append('source URLs must not carry referrals or placeholders')
                except ValueError:
                    errors.append('invalid source URL')
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
    start = guide.get('start_here') or {}
    refs = start.get('source_ids') or []
    for sid in refs:
        if sid not in by_id:
            errors.append(f'guide.start_here: unknown source id {sid!r}')
    if not sources:
        if guide.get('kind') != 'topic_guide' or start.get('kind') != 'observation':
            errors.append('guide.sources: empty only for topic guide study organization')
        else:
            warnings.append('ROOT REVIEW: source-free topic guide must contain only study organization, no technical instruction')
    elif not refs:
        errors.append('guide.start_here: cite the source supporting the first study action')
    if start.get('kind') == 'practice' and not any(by_id.get(s, {}).get('kind') == 'public_instruction' for s in refs):
        errors.append('guide.start_here: practice requires inspected public_instruction evidence')
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
            refs.append({'name': name, 'type': kind, 'url': '/' + '/'.join(slug(p) for p in rel.parts), 'relationship': item.get('relationship', '')})
            break
    return refs
