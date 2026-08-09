import { i18n } from "../i18n"
import { FullSlug, joinSegments, pathToRoot } from "../util/path"
import { JSResourceToScriptElement } from "../util/resources"
import { googleFontHref } from "../util/theme"
import { escapeScriptContent } from "../util/escape"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default (() => {
  const Head: QuartzComponent = ({ cfg, fileData, externalResources }: QuartzComponentProps) => {
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title =
      (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description
    const { css, js } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)

    const iconPath = joinSegments(baseDir, "static/icon.png")
    const ogImagePath = `https://${cfg.baseUrl}/static/og-image.png`
    const canonicalUrl = cfg.baseUrl ? `https://${cfg.baseUrl}/${fileData.slug}` : undefined

    // Opt-out of indexing, declared per page in frontmatter (`noindex: true`).
    //
    // Why this exists (v1.80.2): a page can be one that MUST resolve — hundreds of internal
    // links point at it — while having no indexable content of its own. content/Game Over.md is
    // the case: it is frontmatter only, `cssclasses: [hide-content]`, and it existed as a mount
    // point for the legacy VictoryDisplay, which v1.80.0 deleted. It now emits a ~26KB page whose
    // <article> holds ZERO characters — a soft-404 Google is invited to index. The `/Tree`
    // precedent (v1.80.1) was a 301 to `/`, but that fix does not transfer here: /Tree had ONE
    // inbound link, /Game-Over has ~980 emitted hrefs from 681 content files, so a redirect would
    // turn the graph's documented terminal state into a site-wide 301 hop. Tell crawlers not to
    // index it and leave the URL alone.
    //
    // `noarchive` is deliberately omitted: the goal is "do not index this thin page", not
    // "hide it". Aliases already emit their own noindex (plugins/emitters/aliases.ts).
    const noindex = fileData.frontmatter?.noindex === true

    // Organization schema markup for homepage and all pages
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "BJJ Graph",
      description:
        "Comprehensive Brazilian Jiu-Jitsu knowledge graph and state machine covering 90+ positions, 70+ transitions, and 50+ submissions",
      url: `https://${cfg.baseUrl}`,
      logo: `https://${cfg.baseUrl}/static/icon.png`,
      sameAs: ["https://github.com/diogoseca/bjjgraph"],
    }

    // Get extracted schemas from SchemaExtractor transformer
    const extractedSchemas = fileData.schemas || []

    // Brand/site as the institutional publisher — an Organization, never a Person
    // (content is co-authored). Plus freshness dates from CreatedModifiedDate.
    const publisher = {
      "@type": "Organization",
      name: "BJJ Graph",
      url: `https://${cfg.baseUrl}`,
    }
    const published = fileData.dates?.created?.toISOString()
    const modified = fileData.dates?.modified?.toISOString()
    // Stamp page-level entities with publisher + dates (signals AI answer engines
    // use). CollectionPage covers the submission family hubs.
    const enrichSchema = (schema: any) => {
      const t = schema?.["@type"]
      if (t === "WebPage" || t === "Article" || t === "CollectionPage") {
        return {
          ...schema,
          ...(published ? { datePublished: published } : {}),
          ...(modified ? { dateModified: modified } : {}),
          publisher,
        }
      }
      return schema
    }

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
          </>
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {noindex && <meta name="robots" content="noindex, follow" />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {cfg.baseUrl && <meta property="og:image" content={ogImagePath} />}
        <meta property="og:width" content="1200" />
        <meta property="og:height" content="675" />
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="BJJ Graph" />
        <meta property="og:locale" content="en_US" />
        {fileData.dates?.created && (
          <meta property="article:published_time" content={fileData.dates.created.toISOString()} />
        )}
        {fileData.dates?.modified && (
          <meta property="article:modified_time" content={fileData.dates.modified.toISOString()} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {cfg.baseUrl && <meta name="twitter:image" content={ogImagePath} />}
        <meta name="twitter:image:alt" content={`BJJ Graph - ${title}`} />
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: escapeScriptContent(JSON.stringify(organizationSchema)),
          }}
        />
        {extractedSchemas.map((schema: object, i: number) => (
          <script
            key={`schema-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: escapeScriptContent(JSON.stringify(enrichSchema(schema))),
            }}
          />
        ))}
        {css.map((href) => (
          <link key={href} href={href} rel="stylesheet" type="text/css" spa-preserve />
        ))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute("saved-theme", "dark");`,
          }}
        />
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
