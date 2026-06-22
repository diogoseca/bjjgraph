export const escapeHTML = (unsafe: string) => {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

// Escape an already-stringified JSON value so it is safe to embed inside an HTML
// <script> element — both <script type="application/json"> and inline executable
// JS (e.g. `window.__x = <json>`). Escaping "<" prevents a "</script>" sequence in
// the data from breaking out of the tag; U+2028/U+2029 are valid in JSON but
// terminate a JS string literal. Browsers do NOT HTML-decode <script> contents,
// so escapeHTML would corrupt the JSON — use this for script bodies instead.
export const escapeScriptContent = (json: string) => {
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")
}
