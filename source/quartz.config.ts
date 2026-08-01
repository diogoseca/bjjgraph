import "dotenv/config"
import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4.0 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "BJJ Graph",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "posthog",
      apiKey: process.env.POSTHOG_API_KEY || "",
      host: process.env.POSTHOG_API_HOST,
      uiHost: "https://us.i.posthog.com",
    },
    supabase: {
      url: process.env.SUPABASE_URL || "",
      anonKey: process.env.SUPABASE_ANON_KEY || "",
    },
    locale: "en-US",
    baseUrl: "bjjgraph.org",
    ignorePatterns: [
      "private",
      ".obsidian",
      "CONTRIBUTING-*.md",
      "**/CONTRIBUTING*.md",
      "*.old",
      "*.bak.*",
      "TEMPLATE.*",
      "**/TEMPLATE.*",
      "**/!(bjj-graph).json",
    ],
    defaultDateType: "created",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Plus Jakarta Sans",
        body: "Plus Jakarta Sans",
        code: "JetBrains Mono",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#fff23688",
          // Content-type colors (Tol Bright palette - colorblind-safe)
          graphPosition: "#228833",
          graphTransition: "#aa58d0ff",
          graphSubmission: "#ba2637ff",
          graphPrinciple: "#66CCEE",
          graphSystem: "#4477AA",
          graphTag: "#CCBB44",
          // Per-role strength ramp (graph fill: red = bad for viewer → blue = dominant).
          // Zero is a warm neutral just off the page bg so neutral nodes recede.
          strengthMinus1: "#c2331c",
          strengthMinusHalf: "#e57878",
          strengthZero: "#efe7dd",
          strengthPlusHalf: "#6da3e8",
          strengthPlus1: "#1f5fb8",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#a8a8a8",
          dark: "#d4d4d4",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#b3aa0288",
          // Content-type colors (Tol Bright palette - colorblind-safe)
          graphPosition: "#228833",
          graphTransition: "#aa58d0ff",
          graphSubmission: "#ba2637ff",
          graphPrinciple: "#66CCEE",
          graphSystem: "#4477AA",
          graphTag: "#CCBB44",
          // Per-role strength ramp (brightened for the dark canvas; zero recedes
          // just above the dark page bg).
          strengthMinus1: "#ff6f57",
          strengthMinusHalf: "#d4574a",
          strengthZero: "#2a2a2f",
          strengthPlusHalf: "#5e9be0",
          strengthPlus1: "#8fb6ff",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        // "git" = last-commit date per file (real, per-page). Without it, generated
        // .md share one filesystem birth time → identical "Last updated" everywhere
        // (the bug that got ContentMeta removed in v1.36.1). Needs git history at
        // build time (fetch-depth: 0); falls back to filesystem if unavailable.
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.SchemaExtractor(),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.DevSoundsPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.TrainingData(),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
