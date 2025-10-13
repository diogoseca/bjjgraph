import { i18n } from "../i18n"
import { FullSlug, joinSegments, pathToRoot } from "../util/path"
import { JSResourceToScriptElement } from "../util/resources"
import { googleFontHref } from "../util/theme"
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

    // Organization schema markup for homepage and all pages
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "BJJ Graph",
      "description": "Comprehensive Brazilian Jiu-Jitsu knowledge graph and state machine covering 90+ positions, 70+ transitions, and 50+ submissions",
      "url": `https://${cfg.baseUrl}`,
      "logo": `https://${cfg.baseUrl}/static/icon.png`,
      "sameAs": [
        "https://github.com/diogoseca/bjjgraph"
      ]
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema)
        }} />
        {css.map((href) => (
          <link key={href} href={href} rel="stylesheet" type="text/css" spa-preserve />
        ))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
