---
title: BJJ Graph - Interactive Brazilian Jiu-Jitsu Knowledge Base
---

<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "BJJ Graph",
  "description": "Interactive knowledge graph for Brazilian Jiu-Jitsu covering positions, transitions, submissions, and strategic concepts",
  "url": "https://bjjgraph.org"
}
</script>

<p class="tagline">BJJ game, mapped. Click through positions, see what's next.</p>

<div class="hero-actions">
  <div class="search-roll-bar">
    <button class="search-trigger" aria-label="Search">
      <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <span class="search-placeholder">Search positions, techniques...</span>
    </button>
    <button class="roll-trigger" aria-label="Start a roll">
      <img src="/static/dice-icon.svg" alt="" class="roll-icon" />
      <span>Roll</span>
    </button>
  </div>
</div>

<p class="stats" id="content-stats"></p>
<script>
document.addEventListener("nav", () => {
  const el = document.getElementById("content-stats");
  const s = window.__contentStats;
  if (el && s) el.textContent = `${s.positions} positions. ${s.transitions} transitions. ${s.submissions} submissions. ${s.principles} principles. ${s.systems} systems.`;
});
</script>

<h2 style="display:none;">Browse</h2>

- **[[Positions]]** - Retention, control, and where you are on the mat
- **[[Transitions]]** - Motion and execution between positions
- **[[Submissions]]** - Mechanics of how matches end
- **[[Principles]]** - Concepts that apply everywhere
- **[[Systems]]** - Structured approaches from top competitors

## How It Works

Click any position to see what leads in and out. Every technique shows success rates. **Roll** to start at a random position and play through the game.
