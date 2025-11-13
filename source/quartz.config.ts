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
    },
    locale: "en-US",
    baseUrl: "bjjgraph.org",
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian",
      "CONTRIBUTING-*.md",
      "**/CONTRIBUTING*.md",
      "*.old",
      "*.bak.*",
      "TEMPLATE.*",
      "**/TEMPLATE.*",
      "**/*.json",
      "**/*.jinja2",
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
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
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
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "filesystem"],
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
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
