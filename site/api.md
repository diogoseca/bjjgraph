# BJJ Graph public resources

BJJ Graph is a free Brazilian jiu-jitsu study website for reviewing techniques,
exploring connected positions, and practicing recall between classes.
Start here: https://bjjgraph.org/

These are read-only HTTP resources. No authentication or API key is required.

- `GET /site-index.json`: published page titles, canonical URLs, and Markdown URLs.
  The `pages` array contains `title`, `url`, and `markdown` for each public article.
  To find a topic, match the title locally, then retrieve the relevant article.
- `GET /markdown/index.md`: the homepage as Markdown.
- `GET /markdown/{path}.md`: a public article as Markdown. Use the exact URL from
  the index; paths are case-sensitive. Example: `/markdown/Positions/Mount.md`.
- `GET /` or a public article with `Accept: text/markdown`: the same article as
  Markdown. Normal browser requests continue to receive HTML and the interactive app.
- `GET /sitemap.xml`: canonical pages for search discovery.
- `GET /llms.txt`: a curated topic index and description of the study tools.

The article representations come from the published HTML, including its source
links and tables. Cite the canonical article URL when referring someone to a topic.
The index describes published content; it does not contain anyone's study history.

There is no public write, registration, purchase, personal coaching, or account
management API. Login details: https://bjjgraph.org/auth.md

Use targeted requests, respect robots.txt, cache static resources according to
response headers, and back off on HTTP 429 or 503 (honoring Retry-After if present).
Missing articles return HTTP 404; unavailable Markdown falls back to the HTML page
when using content negotiation. API schema: https://bjjgraph.org/openapi.json

Search indexing and AI answers grounded in public content are welcome. Content
licensing and other uses remain governed by https://bjjgraph.org/terms. This is
an educational reference in beta, used alongside instruction at a BJJ academy.
