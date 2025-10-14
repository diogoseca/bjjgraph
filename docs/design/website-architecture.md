# BJJ Graph Website Architecture

**Version**: 1.0
**Last Updated**: October 2025
**Target Audience**: Developers and technical contributors

---

## Table of Contents

1. [Overview](#overview)
2. [Content Pipeline](#content-pipeline)
3. [Component Architecture](#component-architecture)
4. [Configuration System](#configuration-system)
5. [Build Pipeline](#build-pipeline)
6. [State Machine Integration](#state-machine-integration)
7. [Navigation & Discovery](#navigation--discovery)
8. [Performance Considerations](#performance-considerations)
9. [SEO Architecture](#seo-architecture)
10. [Development Workflow](#development-workflow)

---

## Overview

BJJ Graph is built on **Quartz 4.0**, a static site generator designed for digital gardens and knowledge bases. The architecture transforms structured markdown content into an interactive, interconnected web application with advanced SEO capabilities.

### Core Architecture Principles

1. **Static-First Generation**: All content is pre-rendered at build time for maximum performance
2. **Progressive Enhancement**: JavaScript enhances the experience but isn't required for core functionality
3. **State Machine Paradigm**: Content represents nodes (positions) and edges (transitions) in a BJJ knowledge graph
4. **SEO-Optimized**: Schema.org structured data injected during build for rich search results
5. **Modular Plugin System**: Transformers, filters, and emitters compose the build pipeline

### Technology Stack

- **Static Site Generator**: Quartz 4.0 (TypeScript/Node.js)
- **UI Framework**: Preact (lightweight React alternative)
- **Styling**: SCSS with CSS custom properties for theming
- **Content Format**: Markdown with YAML frontmatter
- **Graph Visualization**: D3.js for interactive knowledge graph
- **Analytics**: Plausible (privacy-focused)
- **Build Tool**: esbuild (fast TypeScript/JavaScript bundler)
- **Development Server**: Chokidar for file watching with hot reload

### Project Structure

```
bjjgraph/source/
├── content/                  # Source markdown files
│   ├── Positions/           # S### state nodes (95 files)
│   ├── Transitions/         # T### edges (71 files)
│   ├── Submissions/         # SUB### terminal states (49 files)
│   ├── Concepts/            # C### principles
│   ├── Systems/             # SC### expert frameworks
│   └── *.md                 # Hub pages and index
├── quartz/                   # Quartz core
│   ├── build.ts             # Build orchestration
│   ├── cfg.ts               # Configuration types
│   ├── components/          # Preact UI components
│   ├── plugins/             # Plugin system
│   │   ├── transformers/    # Content transformation
│   │   ├── filters/         # Content filtering
│   │   └── emitters/        # Output generation
│   ├── processors/          # Build pipeline stages
│   ├── styles/              # SCSS stylesheets
│   ├── static/              # Static assets
│   └── util/                # Utility functions
├── quartz.config.ts         # Site configuration
├── quartz.layout.ts         # Component layout
└── package.json             # Dependencies and scripts
```

---

## Content Pipeline

The content pipeline transforms markdown files through multiple stages before static HTML generation.

### Pipeline Stages

```
┌─────────────────┐
│  Markdown Files │
│   (S###, T###)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  1. Parsing     │  Parse frontmatter, markdown → AST
│  FrontMatter()  │  Extract metadata, titles, descriptions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. Transform   │  Apply 10+ transformers in sequence
│  Transformers   │  • Obsidian Flavored Markdown (wikilinks)
│                 │  • GitHub Flavored Markdown (tables, strikethrough)
│                 │  • Syntax Highlighting (code blocks)
│                 │  • LaTeX (math equations)
│                 │  • Table of Contents generation
│                 │  • Link crawling and resolution
│                 │  • Description extraction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Filtering   │  Remove drafts, apply content filters
│  Filters        │  Filter based on configuration
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. Emission    │  Generate output files
│  Emitters       │  • ContentPage (HTML pages)
│                 │  • FolderPage (directory listings)
│                 │  • TagPage (tag collections)
│                 │  • ContentIndex (JSON, sitemap, RSS)
│                 │  • Assets (images, static files)
│                 │  • ComponentResources (CSS, JS bundles)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Static Output  │
│  /public/       │  Deployable HTML, CSS, JS, assets
└─────────────────┘
```

### Data Flow: Markdown → HTML

#### 1. Frontmatter Extraction

```yaml
---
title: "Mount | Position | BJJ Graph"
description: "Master the mount position with detailed techniques..."
tags: ["position", "top-control", "advanced"]
state_id: S042
---
```

Parsed into VFile data structure:
- `vfile.data.frontmatter`: YAML metadata
- `vfile.data.slug`: URL-friendly path
- `vfile.data.filePath`: Source file location

#### 2. Markdown Transformation

**Wikilinks** (`[[Target Page]]`) are resolved to proper links:
```markdown
[[Closed Guard Bottom]] → [[Guard Retention Concepts]]
```

Becomes:
```html
<a href="/positions/closed-guard-bottom">Closed Guard Bottom</a>
```

**Success Rate Parsing**:
```markdown
(Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
```

Extracted and stored in `vfile.data` for schema generation.

#### 3. Schema Injection

During the emission phase, JSON-LD structured data is injected:

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Mount Position",
  "description": "Master the mount position...",
  "step": [
    {"@type": "HowToStep", "text": "Establish base with knees wide"},
    {"@type": "HowToStep", "text": "Control opponent's hips"}
  ]
}
```

#### 4. Component Rendering

Preact components are server-side rendered with hydration:

```tsx
<Layout>
  <Head /> {/* Meta tags, schema, analytics */}
  <PageTitle /> {/* Site header */}
  <Breadcrumbs /> {/* Navigation trail */}
  <ArticleTitle /> {/* Page title */}
  <Body>{markdownContent}</Body>
  <Graph /> {/* D3 knowledge graph */}
  <TableOfContents />
  <Backlinks />
  <Footer />
</Layout>
```

---

## Component Architecture

BJJ Graph uses **Preact** components with TypeScript for type safety. Components follow a functional, composable design pattern.

### Component Types

#### 1. Layout Components

**Defined in**: `quartz.layout.ts`

```typescript
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),      // Meta tags, analytics, schema
  header: [],                  // Site header (unused)
  afterBody: [],              // Additional body content
  footer: Component.Footer({   // Site footer
    links: {
      GitHub: "https://github.com/diogoseca/bjjgraph",
      "BJJ Graph": "https://bjjgraph.org",
    },
  }),
}
```

**Single Page Layout**:
```typescript
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),   // Home → Positions → Mount
    Component.ArticleTitle(),  // Page heading
    Component.ContentMeta(),   // Date, reading time
    Component.TagList(),       // Tags for categorization
  ],
  left: [
    Component.PageTitle(),     // Site name
    Component.Search(),        // Full-text search
    Component.Darkmode(),      // Theme toggle
    Component.Explorer(),      // File tree navigation
  ],
  right: [
    Component.Graph(),         // Knowledge graph viz
    Component.TableOfContents(), // Section navigation
    Component.Backlinks(),     // Pages linking here
  ],
}
```

#### 2. Core Components

**Head Component** (`quartz/components/Head.tsx`):

Responsible for all `<head>` content:
- Page title and meta description
- Open Graph tags for social sharing
- Twitter Card metadata
- Canonical URLs
- Organization schema (JSON-LD)
- Google Fonts preconnect
- Analytics script injection (Plausible)

Key features:
- Extracts title from frontmatter or falls back to filename
- Generates description from content or frontmatter
- Injects site-wide Organization schema
- Configures proper Open Graph image dimensions (1200x675)

**Graph Component** (`quartz/components/Graph.tsx`):

Interactive D3.js knowledge graph visualization:

```typescript
interface D3Config {
  drag: boolean          // Enable node dragging
  zoom: boolean          // Enable zoom/pan
  depth: number          // Link depth (1 = direct links, -1 = all)
  scale: number          // Initial zoom level
  repelForce: number     // Node repulsion strength
  centerForce: number    // Centering force strength
  linkDistance: number   // Link length
  fontSize: number       // Node label size
  opacityScale: number   // Link opacity
  showTags: boolean      // Display tags on nodes
  focusOnHover: boolean  // Highlight on hover
}
```

Two graph modes:
- **Local Graph**: Shows only direct connections (depth=1)
- **Global Graph**: Shows entire knowledge graph (depth=-1)

**Search Component**:
- Client-side full-text search using Flexsearch
- Indexes titles, headings, and content
- Keyboard navigation (Cmd+K to open)
- Real-time results as you type

**Explorer Component**:
- File tree visualization of content structure
- Collapsible folders
- Highlights current page
- Sorts folders before files

#### 3. Responsive Components

**DesktopOnly / MobileOnly**:

Conditional rendering based on viewport:
```typescript
Component.DesktopOnly(Component.TableOfContents())
Component.MobileOnly(Component.Spacer())
```

CSS media queries control visibility:
```scss
.desktop-only { display: none; }
@media (min-width: 768px) {
  .desktop-only { display: block; }
}
```

#### 4. Component Lifecycle

```typescript
export interface QuartzComponent {
  // Server-side rendering
  (props: QuartzComponentProps): JSX.Element

  // Optional: CSS to include
  css?: string

  // Optional: JavaScript after DOM ready
  afterDOMLoaded?: string

  // Optional: JavaScript before DOM ready
  beforeDOMLoaded?: string
}
```

Example with lifecycle hooks:

```typescript
const Graph: QuartzComponent = ({ cfg, fileData }) => {
  return <div id="graph-container"></div>
}

// Attach SCSS styles (bundled during build)
Graph.css = style

// Attach D3 initialization script (runs after page load)
Graph.afterDOMLoaded = script

export default Graph
```

---

## Configuration System

### quartz.config.ts

Central configuration for site behavior:

```typescript
const config: QuartzConfig = {
  configuration: {
    pageTitle: "BJJ Graph",
    pageTitleSuffix: "",
    enableSPA: true,              // Single-page app navigation
    enablePopovers: true,         // Hover previews for links
    analytics: {
      provider: "plausible",      // Privacy-focused analytics
    },
    locale: "en-US",
    baseUrl: "bjjgraph.org",
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian",
      "CONTRIBUTING-*.md",        // Exclude contributor docs
      "**/CONTRIBUTING*.md",
      "*.old",
    ],
    defaultDateType: "created",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: { /* ... */ },
        darkMode: { /* ... */ },
      },
    },
  },
  plugins: {
    transformers: [ /* 10+ plugins */ ],
    filters: [ /* draft removal */ ],
    emitters: [ /* HTML, JSON, RSS, sitemap */ ],
  },
}
```

#### Key Configuration Options

**SPA Mode** (`enableSPA: true`):
- Client-side navigation for instant page loads
- Preserves scroll position and state
- Preloads linked pages on hover
- Falls back to full page reload if JavaScript disabled

**Popover Previews** (`enablePopovers: true`):
- Hover over wikilinks to see page preview
- Loads content via fetch API
- 300ms delay before showing
- Configurable width and position

**Ignore Patterns**:
- Exclude files from build process
- Supports glob patterns
- CONTRIBUTING-*.md files excluded (automation docs only)

### quartz.layout.ts

Defines component placement on pages:

```typescript
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [],  // Above article content
  left: [],        // Left sidebar
  right: [],       // Right sidebar
}

export const defaultListPageLayout: PageLayout = {
  // Layout for tag pages, folder pages
}
```

**Layout Zones**:
- `head`: Document head (meta, schema, analytics)
- `header`: Site header (above all content)
- `beforeBody`: Before article (breadcrumbs, title, meta)
- `left`: Left sidebar (navigation, search)
- `right`: Right sidebar (graph, TOC, backlinks)
- `afterBody`: After article content
- `footer`: Site footer

---

## Build Pipeline

The build process orchestrates multiple plugins to transform markdown into static HTML.

### Build Process Flow

```typescript
async function buildQuartz(argv, mut, clientRefresh) {
  // 1. Clean output directory
  await rimraf(path.join(output, "*"))

  // 2. Glob all markdown files
  const allFiles = await glob("**/*.*", argv.directory)
  const fps = allFiles.filter(fp => fp.endsWith(".md"))

  // 3. Parse markdown to AST
  const parsedFiles = await parseMarkdown(ctx, filePaths)

  // 4. Filter content (remove drafts)
  const filteredContent = filterContent(ctx, parsedFiles)

  // 5. Build dependency graph (for incremental rebuilds)
  const dependencies = buildDependencyGraph(ctx, filteredContent)

  // 6. Emit all outputs
  await emitContent(ctx, filteredContent)

  // 7. Start dev server (if --serve flag)
  if (argv.serve) {
    return startServing(ctx, mut, parsedFiles, clientRefresh)
  }
}
```

### Plugin System

Quartz uses a three-stage plugin architecture:

#### 1. Transformers

Transform markdown AST during parsing:

```typescript
Plugin.FrontMatter()                    // Parse YAML frontmatter
Plugin.CreatedModifiedDate()            // Extract file dates
Plugin.SyntaxHighlighting()             // Code block highlighting
Plugin.ObsidianFlavoredMarkdown()       // [[Wikilinks]], ![[embeds]]
Plugin.GitHubFlavoredMarkdown()         // Tables, strikethrough, task lists
Plugin.TableOfContents()                // Generate TOC from headings
Plugin.CrawlLinks()                     // Resolve internal links
Plugin.Description()                    // Extract meta description
Plugin.Latex()                          // Render math equations
```

**Example: Link Resolution**

The `CrawlLinks` transformer:
1. Finds all wikilinks `[[Page Name]]`
2. Resolves to actual file paths
3. Generates proper `<a href>` tags
4. Tracks link graph for backlinks

#### 2. Filters

Remove or modify content before emission:

```typescript
Plugin.RemoveDrafts()  // Exclude draft: true frontmatter
```

Custom filters can exclude based on:
- Frontmatter properties
- File paths
- Content analysis

#### 3. Emitters

Generate output files:

```typescript
Plugin.AliasRedirects()      // Create redirects for aliases
Plugin.ComponentResources()  // Bundle CSS/JS for components
Plugin.ContentPage()         // Individual HTML pages
Plugin.FolderPage()          // Directory listing pages
Plugin.TagPage()             // Tag collection pages
Plugin.ContentIndex({        // JSON index, sitemap, RSS
  enableSiteMap: true,
  enableRSS: true,
})
Plugin.Assets()              // Copy images, static files
Plugin.Static()              // Copy static/ directory
Plugin.NotFoundPage()        // Generate 404.html
```

**ContentPage Emitter**:

Renders individual markdown pages to HTML:

```typescript
async emit(ctx, content, resources) {
  for (const [tree, file] of content) {
    const slug = file.data.slug
    const externalResources = getResources(ctx, file)

    // Render Preact components to HTML string
    const html = renderPage(cfg, slug, tree, externalResources, opts)

    // Write to output directory
    const fp = path.join(ctx.argv.output, slug + ".html")
    await fs.writeFile(fp, html)
  }
}
```

### Incremental Rebuilds

For development efficiency, Quartz supports fast incremental rebuilds:

#### Full Rebuild Mode

Rebuilds everything on file change (simpler, slower):
```bash
npx quartz build --serve
```

#### Fast Rebuild Mode

Only rebuilds affected files using dependency graph:
```bash
npx quartz build --serve --fast-rebuild
```

**Dependency Tracking**:
```typescript
// Build dependency graph
const depGraph = new DepGraph<FilePath>()

// a.md links to b.md
depGraph.addEdge("a.md", "b.md")

// When a.md changes, find all downstream dependencies
const affected = depGraph.getLeafNodeAncestors("a.md")
// Result: ["a.html", "contentIndex.json"]
```

**File Watcher**:

Uses Chokidar to watch for changes:
```typescript
const watcher = chokidar.watch(".", {
  cwd: argv.directory,
  ignoreInitial: true,
})

watcher
  .on("add", (fp) => rebuildFromEntrypoint(fp, "add"))
  .on("change", (fp) => rebuildFromEntrypoint(fp, "change"))
  .on("unlink", (fp) => rebuildFromEntrypoint(fp, "delete"))
```

Changes trigger partial rebuild:
1. Parse changed file
2. Update dependency graph
3. Re-emit affected files only
4. Refresh browser via websocket

---

## State Machine Integration

BJJ Graph content represents a **finite state machine** where:
- **Positions** = States (nodes)
- **Transitions** = State changes (edges)
- **Submissions** = Terminal states

### State Identification System

Every piece of content has a unique ID:

- **S###**: Position states (e.g., S042 = Mount)
- **T###**: Transition techniques (e.g., T018 = Hip Bump Sweep)
- **SUB###**: Submissions (e.g., SUB012 = Triangle Choke)
- **C###**: Concepts (e.g., C005 = Base Maintenance)
- **SC###**: Systems (e.g., SC001 = Danaher Back Attack System)

### Frontmatter State Properties

```yaml
---
title: "Mount | Position | BJJ Graph"
state_id: S042
point_value: 4
position_type: Offensive
risk_level: Low
energy_cost: Low
---
```

### Transition Metadata

```yaml
---
transition_id: T018
from_state: S001  # Closed Guard Bottom
to_state: S042    # Mount
success_rate:
  beginner: 40
  intermediate: 55
  advanced: 70
timing_window: "2-3 seconds"
physical_requirements:
  strength: 2
  flexibility: 3
  coordination: 4
  speed: 3
---
```

### Link Graph Construction

During the build process, Quartz constructs an internal link graph:

```typescript
interface LinkGraph {
  nodes: Map<string, {
    slug: string,
    title: string,
    tags: string[],
    stateId?: string,
  }>,
  edges: Map<string, Set<string>>,  // source -> [targets]
}
```

This graph powers:
- **Backlinks**: "What pages link here?"
- **Graph Visualization**: D3.js interactive graph
- **Related Content**: Suggest similar positions/techniques
- **Navigation**: "Next technique in progression"

### State Machine Queries

The content index (`contentIndex.json`) enables queries like:

**Find all transitions from Closed Guard**:
```typescript
contentIndex
  .filter(page => page.from_state === "S001")
  .map(page => ({
    technique: page.title,
    successRate: page.success_rate,
    toState: page.to_state,
  }))
```

**Find optimal path to submission**:
```typescript
// BFS through link graph to find shortest path
function findPathToSubmission(startState: string) {
  const queue = [[startState]]
  const visited = new Set()

  while (queue.length > 0) {
    const path = queue.shift()
    const current = path[path.length - 1]

    if (isSubmissionState(current)) return path

    for (const neighbor of linkGraph.get(current)) {
      if (!visited.has(neighbor)) {
        queue.push([...path, neighbor])
        visited.add(neighbor)
      }
    }
  }
}
```

---

## Navigation & Discovery

BJJ Graph provides multiple navigation mechanisms for content discovery.

### 1. Hub Pages

Strategic landing pages that aggregate related content:

**Location**: `source/content/BJJ-*.md`

- **BJJ-Positions.md**: All 95 position states
- **BJJ-Transitions.md**: All 71 transition techniques
- **BJJ-Submissions.md**: All 49 submission techniques
- **BJJ-Escapes.md**: Defensive techniques by position
- **BJJ-Guard-Passing.md**: Guard passing strategies

**Purpose**:
- SEO content clusters (improved keyword targeting)
- User-friendly entry points
- Internal linking hubs (distribute PageRank)
- Schema.org ItemList markup for rich results

### 2. Explorer Component

File tree navigation in left sidebar:

```
Positions/
├── Closed Guard Bottom
├── Mount
├── Side Control
└── ...
Transitions/
├── Hip Bump Sweep
├── Scissor Sweep
└── ...
Submissions/
├── Rear Naked Choke
├── Triangle Choke
└── ...
```

Features:
- Collapsible folders
- Current page highlighted
- Sorts folders before files
- Respects frontmatter title

### 3. Search

Full-text search powered by Flexsearch:

**Indexing**:
```typescript
const index = new FlexSearch.Document({
  document: {
    id: "slug",
    index: ["title", "content"],
    store: ["title", "tags"],
  },
  tokenize: "forward",
  cache: true,
})
```

**Features**:
- Fuzzy matching
- Searches titles, headings, content
- Keyboard shortcuts (Cmd+K)
- Instant results (client-side index)
- Highlights search terms

**Index Generation**:

During build, `ContentIndex` emitter generates:
```json
[
  {
    "slug": "positions/mount",
    "title": "Mount Position",
    "tags": ["position", "top-control"],
    "content": "The mount is a dominant position...",
    "links": ["positions/side-control", "submissions/americana"]
  }
]
```

Bundled as `static/contentIndex.json` and loaded on page load.

### 4. Interactive Graph

D3.js force-directed graph visualization:

**Local Graph** (right sidebar):
- Shows current page and direct connections
- Depth = 1 (immediate neighbors)
- Smaller, focused view

**Global Graph** (modal overlay):
- Shows entire knowledge graph
- Depth = -1 (all connections)
- Larger, explorable view

**Interaction**:
- Click nodes to navigate
- Drag to reposition
- Zoom and pan
- Hover for highlights

**Data Structure**:
```typescript
interface GraphData {
  nodes: Array<{
    id: string,          // Unique identifier
    text: string,        // Display name
    tags: string[],      // Categories
  }>,
  links: Array<{
    source: string,      // From node ID
    target: string,      // To node ID
  }>
}
```

Generated during build from link graph.

### 5. Backlinks

"What links here?" component in right sidebar:

```typescript
const backlinks = linkGraph
  .filter(([source, targets]) => targets.includes(currentSlug))
  .map(([source]) => ({
    slug: source,
    title: getTitle(source),
  }))
```

Helps discover:
- Related techniques
- Position variations
- Concept applications

### 6. Breadcrumbs

Hierarchical navigation trail:

```
Home → Positions → Mount Position
```

Generated from:
- File path structure
- Frontmatter hierarchy (if defined)
- Schema.org BreadcrumbList markup for SEO

---

## Performance Considerations

BJJ Graph is optimized for speed and scalability.

### Static Generation Benefits

**Why Static > Dynamic**:

1. **Zero Server Processing**: HTML pre-rendered, no database queries
2. **CDN Distribution**: Cache at edge, serve from nearest location
3. **Predictable Performance**: No variability from server load
4. **Security**: No backend to attack, minimal attack surface
5. **Cost**: Free hosting on GitHub Pages, Netlify, Vercel

**Build Time vs. Runtime**:
- Build: ~10-20 seconds for 267 pages
- Runtime: Instant page loads (< 100ms)

### SPA Mode

Single-page application navigation for instant transitions:

```typescript
// Intercept link clicks
document.addEventListener("click", async (e) => {
  if (e.target.tagName === "A" && e.target.origin === location.origin) {
    e.preventDefault()
    const url = new URL(e.target.href)

    // Fetch HTML content
    const response = await fetch(url)
    const html = await response.text()

    // Update page content
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Swap content
    document.body.innerHTML = doc.body.innerHTML

    // Update URL
    history.pushState({}, "", url)

    // Re-run client-side scripts
    initializeComponents()
  }
})
```

Benefits:
- No page reload flash
- Preserves JavaScript state
- Faster perceived performance
- Smooth animations

### Code Splitting

Quartz bundles component scripts separately:

```
static/
├── index.js          # Core bundle (SPA router, search)
├── graph.js          # D3 graph visualization
├── search.js         # Flexsearch index
└── components/*.js   # Individual component scripts
```

Loaded asynchronously:
```html
<script src="/static/index.js" defer></script>
<script src="/static/graph.js" async></script>
```

### CSS Optimization

**Component-Scoped Styles**:

Each component defines its own SCSS:
```typescript
Graph.css = style  // Imported from styles/graph.scss
```

Bundled together during build:
```scss
// Compiled to static/index.css
.graph { /* ... */ }
.search { /* ... */ }
.explorer { /* ... */ }
```

**CSS Custom Properties** for theming:
```scss
:root {
  --light: #faf8f8;
  --darkgray: #4e4e4e;
  --secondary: #284b63;
}

[data-theme="dark"] {
  --light: #161618;
  --darkgray: #d4d4d4;
}
```

JavaScript toggles `data-theme` attribute for instant theme switching.

### Image Optimization

Static assets pipeline:
1. Images placed in `source/static/`
2. Copied to `public/static/` during build
3. Served with proper cache headers

**Future Improvements**:
- WebP conversion
- Responsive image srcsets
- Lazy loading below fold
- BlurHash placeholders

### Analytics Performance

**Plausible Analytics**:
- Lightweight script (< 1KB)
- No cookies, GDPR compliant
- Doesn't block page load
- Self-hosted option available

Configuration:
```typescript
analytics: {
  provider: "plausible",
}
```

Injects script in Head component:
```html
<script defer data-domain="bjjgraph.org"
  src="https://plausible.io/js/script.js">
</script>
```

### Build Performance

**Optimization Strategies**:

1. **Caching**: Quartz caches transformed content in `.quartz-cache/`
2. **Parallel Processing**: Plugins run in parallel where possible
3. **Incremental Builds**: Only rebuild changed files (--fast-rebuild)
4. **esbuild**: Fast TypeScript/JavaScript bundling (10-100x faster than Webpack)

**Build Metrics** (267 pages):
- Cold build: ~15 seconds
- Incremental rebuild: ~500ms
- File change detection: < 50ms

---

## SEO Architecture

BJJ Graph implements comprehensive SEO optimizations at the architecture level.

### Meta Tag Generation

**Head Component** injects dynamic meta tags for every page:

```tsx
<head>
  <title>{title}</title>
  <meta name="description" content={description} />

  {/* Open Graph */}
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImagePath} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:type" content="article" />

  {/* Twitter Card */}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImagePath} />

  {/* Canonical URL */}
  <link rel="canonical" href={canonicalUrl} />
</head>
```

**Dynamic Values**:
- Title: From frontmatter or filename
- Description: From frontmatter or extracted from content
- Canonical URL: `https://bjjgraph.org/{slug}`
- OG Image: Site-wide `/static/og-image.png` (1200x675)

### Schema.org Structured Data

**Six Schema Types** implemented across 267 pages:

#### 1. Organization Schema (Site-Wide)

Injected in Head component:
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BJJ Graph",
  "description": "Comprehensive Brazilian Jiu-Jitsu knowledge graph...",
  "url": "https://bjjgraph.org",
  "logo": "https://bjjgraph.org/static/icon.png",
  "sameAs": ["https://github.com/diogoseca/bjjgraph"]
}
```

#### 2. WebPage Schema (All Pages)

Identifies page as part of website:
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Mount Position",
  "description": "Master the mount position...",
  "url": "https://bjjgraph.org/positions/mount",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.org"
  }
}
```

#### 3. BreadcrumbList Schema (Navigation)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {"@id": "https://bjjgraph.org", "name": "Home"}
    },
    {
      "@type": "ListItem",
      "position": 2,
      "item": {"@id": "https://bjjgraph.org/positions", "name": "Positions"}
    },
    {
      "@type": "ListItem",
      "position": 3,
      "item": {"@id": "https://bjjgraph.org/positions/mount", "name": "Mount"}
    }
  ]
}
```

#### 4. HowTo Schema (Technique Pages)

Step-by-step instruction markup:
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Mount Position",
  "description": "How to establish and maintain mount position",
  "totalTime": "PT5M",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish Base",
      "text": "Position knees wide for stable base..."
    },
    {
      "@type": "HowToStep",
      "name": "Control Hips",
      "text": "Pin opponent's hips to mat..."
    }
  ],
  "supply": [
    {"@type": "HowToSupply", "name": "Gi or No-Gi attire"}
  ]
}
```

#### 5. FAQ Schema (Knowledge Assessment)

Questions from content:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the primary goal of mount position?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Maintain dominant control while threatening submissions..."
      }
    }
  ]
}
```

#### 6. ItemList Schema (Hub Pages)

List of related techniques:
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "BJJ Submissions",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "HowTo",
        "name": "Rear Naked Choke",
        "url": "https://bjjgraph.org/submissions/rear-naked-choke"
      }
    }
  ]
}
```

### Schema Injection Pipeline

**Automated Scripts** add schema during content creation:

1. **add_webpage_schema.py**: Base WebPage schema
2. **add_breadcrumb_schema.py**: BreadcrumbList navigation
3. **add_position_schema_v2.py**: HowTo + FAQ for positions
4. **add_transition_schema_v2.py**: HowTo + FAQ for transitions

**Injection Point**:

Schema is inserted as `<script type="application/ld+json">` in markdown:

```markdown
---
title: "Mount Position"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Mount Position"
}
</script>

## Mount Position

The mount is a dominant top position...
```

During build, Quartz preserves these scripts in HTML output.

### Sitemap Generation

**ContentIndex** emitter generates XML sitemap:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://bjjgraph.org/positions/mount</loc>
    <lastmod>2025-10-12</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

Automatically includes:
- All published pages (267+)
- Last modification dates
- Change frequency hints
- Priority scores

Submitted to Google Search Console for indexing.

### RSS Feed

**ContentIndex** emitter also generates RSS feed:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BJJ Graph</title>
    <link>https://bjjgraph.org</link>
    <description>Brazilian Jiu-Jitsu Knowledge Graph</description>
    <item>
      <title>Mount Position</title>
      <link>https://bjjgraph.org/positions/mount</link>
      <description>Master the mount position...</description>
      <pubDate>Sat, 12 Oct 2025 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

Enables content syndication and RSS readers.

### Internal Linking Strategy

**Automated Wikilinks**:

Every page includes 10-15 internal links via wikilinks:
- Related positions
- Prerequisite techniques
- Submission paths
- Defensive counters

Example from Mount position:
```markdown
From [[Mount]], you can transition to:
- [[Technical Mount]] for better control
- [[S-Mount Position]] for armbar setups
- [[Back Control]] via opponent's escape attempt

Common submissions:
- [[Americana]]
- [[Arm Triangle]]
- [[Ezekiel Choke]]
```

Benefits:
- Distributes PageRank throughout site
- Helps Google understand content relationships
- Improves user engagement (internal navigation)
- Reduces bounce rate

### Canonical URLs

Every page includes canonical tag:

```html
<link rel="canonical" href="https://bjjgraph.org/positions/mount" />
```

Prevents duplicate content issues from:
- URL parameters
- Subdomain variations
- HTTP vs. HTTPS

### Performance SEO

**Core Web Vitals**:
- **LCP** (Largest Contentful Paint): < 1s (static HTML)
- **FID** (First Input Delay): < 50ms (minimal JavaScript)
- **CLS** (Cumulative Layout Shift): 0 (no layout shifts)

**Mobile Optimization**:
- Responsive design (viewport meta tag)
- Touch-friendly navigation
- Readable font sizes
- No horizontal scrolling

**HTTPS**:
- Served over HTTPS (required for SEO)
- HTTP redirects to HTTPS

---

## Development Workflow

### Local Development

**Setup**:
```bash
cd source
npm install
```

**Development Server**:
```bash
npx quartz build --serve
# Server running at http://localhost:8080
```

**Features**:
- Hot reload on file changes
- Live browser refresh via WebSocket
- Fast incremental rebuilds (< 1s)
- Source maps for debugging

### Content Creation

**New Position**:
```bash
cd source/content/Positions
# Create new file
touch "New Position.md"
```

**Template**:
```markdown
---
title: "New Position | Position | BJJ Graph"
description: "Master new position with detailed guide..."
state_id: S###
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "New Position"
}
</script>

## New Position

[Content here]
```

**Validation**:
```bash
python3 scripts/validate_content.py source/content/Positions/ --verbose
```

**Schema Addition**:
```bash
python3 scripts/add_webpage_schema.py
python3 scripts/add_breadcrumb_schema.py
python3 scripts/add_position_schema_v2.py
```

### Testing

**Local Testing**:
1. Build site: `npx quartz build`
2. Serve locally: `python3 -m http.server -d public 8080`
3. Open browser: `http://localhost:8080`

**Schema Validation**:
1. View page source
2. Copy JSON-LD schema
3. Paste into https://validator.schema.org/
4. Fix any errors

**SEO Testing**:
1. Rich Results Test: https://search.google.com/test/rich-results
2. Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
3. Lighthouse Audit: Chrome DevTools → Lighthouse

### Deployment

**GitHub Pages** (automatic):
```bash
git add .
git commit -m "Update content"
git push origin main
# GitHub Actions builds and deploys
```

**Manual Build**:
```bash
npx quartz build
# Upload public/ directory to hosting
```

### Debugging

**Build Errors**:
```bash
# Verbose mode
npx quartz build --verbose

# Check logs
# Build errors show file and line number
```

**Component Errors**:
- Check browser console for JavaScript errors
- Inspect element to see rendered HTML
- Verify component props in `quartz.layout.ts`

**Schema Errors**:
- Google Search Console → Enhancements
- Check for parsing errors
- Validate JSON-LD syntax

---

## Summary

BJJ Graph's architecture combines:

1. **Static-First Generation**: Pre-rendered HTML for performance and SEO
2. **Modular Plugin System**: Composable transformers, filters, and emitters
3. **State Machine Paradigm**: Content as nodes (positions) and edges (transitions)
4. **Rich SEO**: Six schema types across 267 pages for enhanced search visibility
5. **Interactive Components**: D3 graph, search, explorer for content discovery
6. **Progressive Enhancement**: JavaScript enhances but doesn't block core functionality

This architecture enables:
- **Fast Performance**: < 100ms page loads, instant SPA navigation
- **Scalability**: Supports 1,000+ pages without performance degradation
- **Maintainability**: Clear separation of concerns, plugin-based extensibility
- **SEO Excellence**: 99% schema coverage, structured data, optimal meta tags
- **Developer Experience**: Hot reload, fast rebuilds, comprehensive validation tools

---

**Version History**:
- **v1.0 (October 2025)**: Initial architecture documentation

**Related Documentation**:
- `/docs/CONTRIBUTING.md` - Developer guide
- `/docs/seo-strategy.md` - SEO implementation details
- `/scripts/README.md` - Automation scripts
- `CLAUDE.md` - Project overview
