export function capitalize(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1)
}

export function classNames(
  displayClass?: "mobile-only" | "desktop-only" | "not-desktop",
  ...classes: string[]
): string {
  if (displayClass) {
    classes.push(displayClass)
  }
  return classes.join(" ")
}

/**
 * Strips SEO suffix from page titles for display purposes.
 * Removes " | [Type] | BJJ Graph" patterns from titles.
 */
export function stripTitleSuffix(title: string): string {
  return title.split(" | ")[0].trim()
}
