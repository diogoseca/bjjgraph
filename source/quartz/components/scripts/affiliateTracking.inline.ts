// Affiliate / Systems conversion funnel for PostHog.
//   Step 1: related_system_card_click  (node page -> system page)
//   Step 2: system_page_view           (landed on a system page)
//   Step 3: affiliate_clickout         (clicked a BJJFanatics product CTA)
// Mirrors the direct window.posthog.capture pattern used in moveCards/flashcard.

function capture(event: string, props: Record<string, unknown>) {
  const ph = (window as any).posthog
  if (ph?.capture) ph.capture(event, props)
}

function systemMemberCount(): number {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return 0
  try {
    const d = JSON.parse(el.textContent)
    return d?.type === "system" && Array.isArray(d.members) ? d.members.length : 0
  } catch {
    return 0
  }
}

function systemName(): string {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return ""
  try {
    const d = JSON.parse(el.textContent)
    return d?.type === "system" ? d.name || "" : ""
  } catch {
    return ""
  }
}

// document.body carries data-slug (renderPage.tsx), not data-content-type — derive the
// content type from the slug prefix.
function contentTypeFromSlug(): string {
  const slug = (document.body.dataset.slug || "").toLowerCase()
  const prefix = slug.split("/")[0]
  return ["positions", "transitions", "submissions", "principles", "systems"].includes(prefix)
    ? prefix
    : ""
}

// One delegated click listener (module scope → bound once, survives SPA nav).
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement | null
  if (!target) return

  const affiliate = target.closest('a[data-affiliate="true"]') as HTMLAnchorElement | null
  if (affiliate) {
    capture("affiliate_clickout", {
      product_id: affiliate.dataset.productId || "",
      vendor: affiliate.dataset.vendor || "",
      system_slug: affiliate.dataset.systemSlug || "",
      system_name: affiliate.dataset.systemName || "",
      affiliate_url: affiliate.href,
      position: Number(affiliate.dataset.position || "0"),
    })
    return
  }

  const card = target.closest('a[data-cta="related-system-card"]') as HTMLAnchorElement | null
  if (card) {
    capture("related_system_card_click", {
      system_slug: card.dataset.systemSlug || "",
      system_name: card.dataset.systemName || "",
      source_slug: window.location.pathname,
      source_content_type: contentTypeFromSlug(),
      member_count: Number(card.dataset.memberCount || "0"),
      cards_shown: document.querySelectorAll('a[data-cta="related-system-card"]').length,
    })
  }
})

// system_page_view, once per system page (the spaNavigate in-place re-render used by
// the unlock UX re-fires `nav`, so dedupe by slug).
let lastViewedSystem: string | null = null
document.addEventListener("nav", () => {
  const slug = (document.body.dataset.slug || "").toLowerCase()
  if (!slug.startsWith("systems/")) return
  if (slug === lastViewedSystem) return
  lastViewedSystem = slug
  capture("system_page_view", {
    system_slug: slug,
    system_name: systemName(),
    product_count: document.querySelectorAll(".product-card").length,
    member_count: systemMemberCount(),
  })
})
