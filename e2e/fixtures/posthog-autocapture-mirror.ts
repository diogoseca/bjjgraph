import type { Page } from "@playwright/test";

/**
 * WHAT POSTHOG'S AUTOCAPTURE READS FOR A CLICK — a transcription of posthog-js 1.447.12, the version the site's snippet loads
 * (`/static/array.js` from the configured host, read on 2026-11-12; source at the tag `posthog-js@1.447.12`, packages/browser-common).
 * The harness is keyless and aborts every non-localhost request, so no journey can run the real library; this is the library's click
 * path, copied function by function, so a journey can ask "what would PostHog have sent for THIS press" of the real app's DOM.
 *
 *   src/autocapture.ts              constructor's DOM handler: pointer tracking, `_recoverClickTarget`, then `_captureEvent`
 *                                   `_isExcludedPointerTarget` · `_trackPointer` · `autocapturePropertiesForElement`
 *                                   `getPropertiesFromElement` · `getAugmentPropertiesFromElement` · `limitText`
 *   src/utils/autocapture-utils.ts  `shouldCaptureDomEvent` (default config: no allowlists, ignore list `.ph-no-autocapture`,
 *                                   `[data-ph-no-autocapture]`) · `shouldCaptureElement` · `isSensitiveElement` · `getSafeText`
 *                                   `makeSafeText` · `shouldCaptureValue` (anchored CC/SSN) · `getDirectAndNestedSpanText`
 *                                   `getNestedSpanText` · `getClassNames` · `getElementsChainString` (`extractElements`, `elementsToString`)
 *
 * It answers for `$autocapture` clicks, and so for `$rageclick` (the same `_captureEvent`) and `$dead_click` (the lazy extension builds
 * its properties with the same `autocapturePropertiesForElement`, and skips `.ph-no-capture` chains in `shouldCaptureDeadClick`).
 * NOT mirrored: `$element_selectors` (selectors the project configured, matched against the target, never text), heatmaps (x, y and
 * `target_fixed` only), copied-text capture (`capture_copied_text`, off unless init turns it on; ours does not) and the `isEnabled`
 * gate (the mirror assumes autocapture is on, as the project's settings have it). When the site's posthog-js version moves, re-read
 * these functions at the new tag and update this file and its version line together.
 */
export const POSTHOG_JS_MIRRORED = "1.447.12";

/** Installs `window.__phMirror` before any app script: capture-phase listeners on `document`, registered first, read the DOM in the
 *  same phase and order the library's own (`addEventListener(document, 'click', handler, { capture: true })`) would. */
export async function installAutocaptureMirror(page: Page) {
  await page.addInitScript(() => {
    const COMPAT = ["a", "button", "form", "input", "select", "textarea", "label"];
    const IGNORE = [".ph-no-autocapture", "[data-ph-no-autocapture]"];
    const MAX = 1000;
    const isTag = (el: any, tag: string) => !!el && !!el.tagName && el.tagName.toLowerCase() === tag.toLowerCase();
    const isEl = (n: any) => !!n && n.nodeType === 1;
    const isShadow = (n: any) => !!n && n.nodeType === 11 && !!n.host;
    const trim = (s: string) => (s || "").trim();
    const split = (s: string) => (s ? trim(s).split(/\s+/) : []);
    const classes = (el: any): string[] => {
      let c = "";
      if (typeof el.className === "string") c = el.className;
      else if (typeof el.className === "object") c = (el.className && "baseVal" in el.className ? el.className.baseVal : null) || el.getAttribute("class") || "";
      return split(c);
    };
    const cc = `(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11})`;
    const ccRe = new RegExp(`^(?:${cc})$`), ssnRe = new RegExp(`^(\\d{3}-?\\d{2}-?\\d{4})$`);
    const shouldCaptureValue = (v: any) => {
      if (v == null) return false;
      if (typeof v === "string") { v = trim(v); if (ccRe.test((v || "").replace(/[- ]/g, ""))) return false; if (ssnRe.test(v)) return false; }
      return true;
    };
    const matches = (el: any, sel: string) => { try { return el.matches ? el.matches(sel) : false; } catch { return false; } };
    const shouldCaptureElement = (el: any) => {
      const seen = new Set();
      let depth = 0;
      for (let cur = el; cur.parentNode && !isTag(cur, "body"); cur = cur.parentNode) {
        if (depth++ >= MAX || seen.has(cur)) return false;
        seen.add(cur);
        const c = classes(cur);
        if (c.includes("ph-sensitive") || c.includes("ph-no-capture")) return false;
      }
      if (classes(el).includes("ph-include")) return true;
      const type = el.type || "";
      if (typeof type === "string" && (type.toLowerCase() === "hidden" || type.toLowerCase() === "password")) return false;
      const name = el.name || el.id || "";
      if (typeof name === "string" && /^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i.test(name.replace(/[^a-zA-Z0-9]/g, ""))) return false;
      return true;
    };
    const isSensitiveElement = (el: any) =>
      (isTag(el, "input") && !["button", "checkbox", "submit", "reset"].includes(el.type)) || isTag(el, "select") || isTag(el, "textarea") || el.getAttribute("contenteditable") === "true";
    const makeSafeText = (s: any) => s == null ? null
      : trim(s).split(/(\s+)/).filter((x: string) => shouldCaptureValue(x)).join("").replace(/[\r\n]/g, " ").replace(/[ ]+/g, " ").substring(0, 255);
    const getSafeText = (el: any) => {
      let t = "";
      if (shouldCaptureElement(el) && !isSensitiveElement(el) && el.childNodes && el.childNodes.length)
        for (const ch of Array.from(el.childNodes) as any[]) if (ch.nodeType === 3 && ch.textContent) t += makeSafeText(ch.textContent) ?? "";
      return trim(t);
    };
    const nestedSpanText = (target: any): string => {
      let t = "";
      if (target && target.childNodes && target.childNodes.length)
        for (const ch of Array.from(target.childNodes) as any[]) if (ch && ch.tagName?.toLowerCase() === "span") {
          t = `${t} ${getSafeText(ch)}`.trim();
          if (ch.childNodes && ch.childNodes.length) t = `${t} ${nestedSpanText(ch)}`.trim();
        }
      return t;
    };
    const spanText = (target: any) => { const t = `${getSafeText(target)} ${nestedSpanText(target)}`.trim(); return shouldCaptureValue(t) ? t : ""; };
    const limitText = (n: number, s: string) => (s.length > n ? s.slice(0, n) + "..." : s);
    const parentsOf = (el: any) => {   // getElementAndParentsForElement(el, false)
      let useful = false;
      const list = [el];
      let cur = el;
      while (cur.parentNode && !isTag(cur, "body")) {
        if (isShadow(cur.parentNode)) { list.push(cur.parentNode.host); cur = cur.parentNode.host; continue; }
        const p = isEl(cur.parentNode) ? cur.parentNode : null;
        if (!p) break;
        if (COMPAT.includes(p.tagName.toLowerCase())) useful = true;
        else { try { if (getComputedStyle(p).getPropertyValue("cursor") === "pointer") useful = true; } catch {} }
        list.push(p); cur = p;
      }
      return { useful, list };
    };
    const shouldCaptureDomEvent = (el: any, e: Event) => {
      if (!el || isTag(el, "html") || !isEl(el)) return false;
      const { useful, list } = parentsOf(el);
      if (list.some((x: any) => IGNORE.some((s) => matches(x, s)))) return false;
      try { if (getComputedStyle(el).getPropertyValue("cursor") === "pointer" && e.type === "click") return true; } catch {}
      const tag = el.tagName.toLowerCase();
      if (tag === "html") return false;
      if (tag === "form") return e.type === "submit";
      if (tag === "input" || tag === "select" || tag === "textarea") return ["change", "click"].includes(e.type);
      if (useful) return e.type === "click";
      return e.type === "click" && (COMPAT.includes(tag) || el.getAttribute("contenteditable") === "true");
    };
    const propsOf = (elem: any) => {   // getPropertiesFromElement(elem, false, false, undefined, false)
      const tag = elem.tagName.toLowerCase();
      const p: any = { tag_name: tag };
      if (COMPAT.includes(tag)) p.$el_text = limitText(1024, tag === "a" || tag === "button" ? spanText(elem) : getSafeText(elem));
      const c = classes(elem);
      if (c.length > 0) p.classes = c.filter((x) => x !== "");
      for (const a of Array.from(elem.attributes) as Attr[]) {
        if (isSensitiveElement(elem) && !["name", "id", "class", "aria-label"].includes(a.name)) continue;
        if (shouldCaptureValue(a.value) && !(a.name.startsWith("_ngcontent") || a.name.startsWith("_nghost")))
          p["attr__" + a.name] = limitText(1024, a.name === "class" ? split(a.value).join(" ") : a.value);
      }
      let nthChild = 1, nthOfType = 1, cur = elem;
      const prev = (el: any) => { if (el.previousElementSibling) return el.previousElementSibling; let x = el; do { x = x.previousSibling; } while (x && !isEl(x)); return x; };
      while ((cur = prev(cur))) { nthChild++; if (cur.tagName === elem.tagName) nthOfType++; }
      p.nth_child = nthChild; p.nth_of_type = nthOfType;
      return p;
    };
    const augmentOf = (elem: any) => {
      if (!shouldCaptureElement(elem)) return {};
      const p: any = {};
      for (const a of Array.from(elem.attributes) as Attr[]) if (a.name && a.name.indexOf("data-ph-capture-attribute") === 0) {
        const k = a.name.replace("data-ph-capture-attribute-", "");
        if (k && a.value && shouldCaptureValue(a.value)) p[k] = a.value;
      }
      return p;
    };
    const chainString = (els: any[]) => els.map((el) => {
      let s = el.tag_name || "";
      const cls = el.attr__class ? split(el.attr__class) : undefined;
      if (cls) { cls.sort(); for (const c of cls) s += `.${c.replace(/"/g, "")}`; }
      const attrs: any = { ...(el.$el_text?.slice(0, 400) ? { text: el.$el_text.slice(0, 400) } : {}), "nth-child": el.nth_child ?? 0, "nth-of-type": el.nth_of_type ?? 0,
        ...(el.attr__href ? { href: el.attr__href.slice(0, 2048) } : {}), ...(el.attr__id ? { attr_id: el.attr__id } : {}) };
      for (const k of Object.keys(el)) if (k.indexOf("attr__") === 0) attrs[k] = el[k];
      const esc = (x: string) => x.replace(/"|\\"/g, '\\"');
      return s + ":" + Object.entries(attrs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${esc(String(k))}="${esc(String(v))}"`).join("");
    }).join(";");
    const autocaptureProps = (target: any, e: Event) => {   // autocapturePropertiesForElement
      if (!isEl(target)) return { props: {} as any };
      const list = [target];
      const seen = new Set([target]);
      let cur = target;
      while (cur.parentNode && !isTag(cur, "body")) {
        if (list.length >= MAX) break;
        if (isShadow(cur.parentNode)) { const h = cur.parentNode.host; if (seen.has(h)) break; seen.add(h); list.push(h); cur = h; continue; }
        if (!isEl(cur.parentNode) || seen.has(cur.parentNode)) break;
        seen.add(cur.parentNode); list.push(cur.parentNode); cur = cur.parentNode;
      }
      const controlIndex = e.type === "click" && target.namespaceURI === "http://www.w3.org/2000/svg" ? list.findIndex((x: any) => isTag(x, "button") || isTag(x, "a")) : -1;
      let maskAllText = false;
      if (controlIndex > 0) maskAllText = list.slice(0, controlIndex + 1).some((x: any) => !shouldCaptureElement(x) || isSensitiveElement(x));
      const els: any[] = [], aug: any = {};
      let href: any = false, explicitNoCapture = false;
      for (const el of list) {
        if (isTag(el, "a")) { const h = el.getAttribute("href"); href = shouldCaptureElement(el) && !!h && shouldCaptureValue(h) ? h : false; }
        if (classes(el).includes("ph-no-capture")) explicitNoCapture = true;
        const p = propsOf(el);
        if (maskAllText) delete p.$el_text;
        els.push(p);
        for (const [k, v] of Object.entries(augmentOf(el))) if (!Object.prototype.hasOwnProperty.call(aug, k)) aug[k] = v;
      }
      if (explicitNoCapture) return { props: {}, explicitNoCapture };
      let t = target;
      if (controlIndex > 0) { t = list[controlIndex]; els.splice(0, controlIndex); }
      if (!maskAllText) els[0].$el_text = isTag(t, "a") || isTag(t, "button") ? spanText(t) : getSafeText(t);
      if (href) els[0].attr__href = href;
      return { props: { $event_type: e.type, $ce_version: 1, $elements_chain: chainString(els), ...(els[0]?.$el_text ? { $el_text: els[0].$el_text } : {}), ...aug } };
    };
    const excludedPointer = (target: any) => {   // _isExcludedPointerTarget
      if (!shouldCaptureElement(target)) return true;
      let el = target;
      const seen = new Set();
      while (el) {
        if (seen.size >= MAX || seen.has(el)) return true;
        seen.add(el);
        const c = classes(el);
        if (c.includes("ph-no-capture") || c.includes("ph-sensitive") || isSensitiveElement(el) || IGNORE.some((s) => matches(el, s))) return true;
        const parent = el.parentNode;
        el = isShadow(parent) ? parent.host : parent && isEl(parent) ? parent : null;
      }
      return false;
    };
    let down: any;
    const clear = () => { down = undefined; };
    const eventTarget = (e: any) => (e.target?.shadowRoot ? e.composedPath()[0] : e.target) || null;
    const onPointer = (e: any) => {   // _trackPointer
      if (e.type === "pointercancel") { clear(); return; }
      if (e.type === "pointerdown") {
        clear();
        const t = eventTarget(e);
        if (e.isPrimary && e.button === 0 && !e.ctrlKey && t && isEl(t)) down = { target: t, excluded: excludedPointer(t), id: e.pointerId, x: e.clientX, y: e.clientY, released: false };
        return;
      }
      if (!down) return;
      if (e.pointerId !== down.id || Math.abs(e.clientX - down.x) > 5 || Math.abs(e.clientY - down.y) > 5) clear();
      else if (e.type === "pointerup") { down.released = true; setTimeout(clear, 0); }
    };
    const recover = (e: any) => {   // _recoverClickTarget
      const d = down; clear();
      const t = eventTarget(e);
      if (d?.released && d.target.isConnected && e.pointerId === d.id && (e.detail > 0 || e.pointerType === "touch" || e.pointerType === "pen") && e.button === 0
        && Math.abs(e.clientX - d.x) <= 5 && Math.abs(e.clientY - d.y) <= 5 && t && (isTag(t, "html") || isTag(t, "body"))) {
        if (d.excluded) return null;
        const roots = [t, document.documentElement, document.body];
        if (roots.some((r: any) => r && (classes(r).includes("ph-no-capture") || classes(r).includes("ph-sensitive") || !shouldCaptureElement(r) || isSensitiveElement(r) || IGNORE.some((s) => matches(r, s))))) return null;
        return d.target;
      }
      return undefined;
    };
    const describe = (el: any) => !el ? "nothing" : el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + split(el.className).join(".") : "");
    const events: any[] = [];
    const onClick = (e: any) => {
      const override = recover(e);
      const entry: any = { at: events.length, target: describe(eventTarget(e)), pointerType: e.pointerType || "" };
      if (override === null) { entry.captured = false; entry.why = "pointerdown origin excluded"; events.push(entry); return; }
      let target = override || eventTarget(e);
      if (target && target.nodeType === 3) target = target.parentNode;
      entry.attributedTo = describe(target);
      if (!(target && shouldCaptureDomEvent(target, e))) { entry.captured = false; entry.why = "not a capturable click"; events.push(entry); return; }
      const r: any = autocaptureProps(target, e);
      if (r.explicitNoCapture) { entry.captured = false; entry.why = "ph-no-capture in the chain"; events.push(entry); return; }
      entry.captured = true;
      entry.props = r.props;
      events.push(entry);
    };
    for (const type of ["pointerdown", "pointerup", "pointercancel"]) document.addEventListener(type, onPointer, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    (window as any).__phMirror = { version: "1.447.12", events };
  });
}

/** The mirror's record of every click since boot (a coverage count comes with it: an empty list means nothing was pressed). */
export const mirrorEvents = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__phMirror.events)));
