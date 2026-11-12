import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk";
import { installAutocaptureMirror, mirrorEvents, POSTHOG_JS_MIRRORED } from "../fixtures/posthog-autocapture-mirror";

/**
 * A SIGNED-IN PLAYER'S NAME OR ADDRESS NEVER REACHES ANALYTICS (v1.262.3). The privacy page says analytics are not told who you are,
 * and the app never calls identify(); but it PRINTS the name, its initial and the address, and PostHog's autocapture and session
 * replay read what is printed (the NG_NO_CAPTURE note in neural/src/app.src.jsx has the mechanism, quoted from posthog-js 1.447.12).
 *
 * What this pins, signed in as player@example.com / "Player Example" through the real façade and owner host (the SDK is the fixture):
 *  (a) THE REPLAY'S RULE, on the badge, the open account menu and Settings → Notifications: no text node and no attribute outside a
 *      `ph-no-capture` element carries the address, the name, the local part or the initial. That is rrweb's blockClass as posthog-js
 *      configures it: a blocked element is recorded as its class and size only, nothing under it. The same identity IS on screen,
 *      asserted beside it, so a scan that found nothing because nothing was printed cannot pass.
 *  (b) WHAT AUTOCAPTURE READS for real presses: by mouse on the badge, on the name itself, on the avatar, on the menu's top row and in
 *      Settings; by a real touch tap on a phone. `e2e/fixtures/posthog-autocapture-mirror.ts` is posthog-js 1.447.12's click path,
 *      transcribed; every press must be SEEN by it (one event per press), and none of its properties may hold the identity. The badge
 *      press must still be COUNTED (captured, `button.ngAcctChip` in the chain), also when it lands on the name: the owner reads those.
 *  (c) An email-and-password account, whose name IS the address's local part ("player"), on the badge and the menu.
 *
 * NOT covered: the real posthog-js (the harness is keyless and offline; the mirror was checked against the real library once, locally,
 * see the archive), the import dialog (PR #375 deletes it), text a replay records that is not the identity, copied-text capture (off),
 * and keyboard activation (a keyboard click's target is the focused button itself, which carries no identity in its own attributes).
 */

// The local part "player" is also a word of the corpus's own prose ("the bottom player", four times in Mount's article), so as a
// needle it is matched as a WHOLE text or attribute value, which is how the app prints a name derived from it; the address and the
// full name are matched anywhere in a value. The email-and-password account (c) uses a local part no article contains, matched anywhere.
const EMAIL = "player@example.com", NAME = "Player Example", LOCAL = "player", INITIAL = "P";
const ONLY_EMAIL = "pex.mask1@example.com", ONLY_LOCAL = "pex.mask1";
type Needles = { words: string[]; whole: string[]; initial: string };
const PLAYER: Needles = { words: [EMAIL, NAME].map((w) => w.toLowerCase()), whole: [LOCAL], initial: INITIAL };
const EMAIL_ONLY: Needles = { words: [ONLY_EMAIL, ONLY_LOCAL], whole: [], initial: "P" };

/** rrweb's rule (blockClass 'ph-no-capture'): everything outside a blocked element is recorded, text and attributes; a blocked element
 *  keeps only `class`. Returns what it looked at too, so "found nothing" and "looked at nothing" read differently. */
const scanOutsideMarks = (page: Page, needles: Needles) =>
  page.evaluate(({ words, whole, initial }) => {
    const hit = (v: string) => { const s = (v || "").toLowerCase(), t = s.trim(); return words.some((w) => s.includes(w)) || whole.includes(t) || (v || "").trim() === initial; };
    const out = { elements: 0, texts: 0, marks: 0, leaks: [] as string[] };
    const tag = (el: Element) => "<" + el.tagName.toLowerCase() + (el.getAttribute("class") ? " class=" + JSON.stringify(el.getAttribute("class")) : "") + ">";
    const walk = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n: Node | null = walk.currentNode; n; n = walk.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        const p = n.parentElement;
        if (!p || p.closest(".ph-no-capture")) continue;
        out.texts++;
        if (hit(n.textContent || "")) out.leaks.push("text " + JSON.stringify(n.textContent) + " in " + tag(p));
        continue;
      }
      const el = n as Element, own = el.classList.contains("ph-no-capture");
      if (!own && el.closest(".ph-no-capture")) continue;
      if (own) out.marks++; else out.elements++;
      for (const a of Array.from(el.attributes)) {
        if (own && a.name !== "class") continue;
        if (hit(a.value)) out.leaks.push("attribute " + a.name + "=" + JSON.stringify(a.value) + " on " + tag(el));
      }
    }
    return out;
  }, needles);

const expectNothingOutsideMarks = async (page: Page, where: string, onScreen: string, needles: Needles = PLAYER) => {
  const s = await scanOutsideMarks(page, needles);
  expect(s.elements, where + ": the scan looked at the page").toBeGreaterThan(100);
  expect(await page.evaluate(() => document.body.innerText), where + ": the identity is on screen for the player").toContain(onScreen);
  expect(s.leaks, where + ": nothing outside a ph-no-capture element carries the identity").toEqual([]);
  expect(s.marks, where + ": the identity on screen sits in marked elements").toBeGreaterThan(0);
};

/** Every property the mirror says PostHog would send, and every text in the chain, is free of the identity. */
const identityIn = (ev: any, n: Needles = PLAYER) => {
  const all = JSON.stringify(ev.props || {}).toLowerCase(), chain = (ev.props && ev.props.$elements_chain) || "";
  const values = [...chain.matchAll(/="((?:[^"\\]|\\.)*)"/g)].map((m: RegExpMatchArray) => m[1]);
  if (ev.props && typeof ev.props.$el_text === "string") values.push(ev.props.$el_text);
  return [...n.words.filter((w) => all.includes(w)), ...values.filter((v) => n.whole.includes(v.trim().toLowerCase()) || v.trim() === n.initial)];
};

/** One press, seen by the mirror exactly once, and what it read. */
const pressed = async (page: Page, before: number, what: string, needles: Needles = PLAYER) => {
  const evs = (await mirrorEvents(page)).slice(before);
  expect(evs.length, what + ": the mirror saw the press (posthog-js " + POSTHOG_JS_MIRRORED + ")").toBe(1);
  expect(identityIn(evs[0], needles), what + ": autocapture reads none of the identity: " + JSON.stringify(evs[0])).toEqual([]);
  return evs[0];
};
const counted = (ev: any, what: string) => {
  expect(ev.captured, what + ": the click is still counted: " + JSON.stringify(ev)).toBe(true);
  expect(ev.props.$elements_chain, what + ": counted as the badge").toMatch(/(^|;)button\.ngAcctChip[.:]/);
};
const menuOpen = (page: Page) => page.evaluate(() => !!(window as any).__neural._acctMenuOpen);
const centre = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector(s)!, r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y), chip = document.querySelector(".ngAcctChip");
  return { x, y, w: r.width, inChip: !!(chip && top && chip.contains(top)), onMark: !!(top && top.closest(".ph-no-capture")) };
}, sel);

const signedIn = async (page: Page, profile: { email: string; name: string | null }, id = "mask-player") => {
  await installAutocaptureMirror(page);
  const j = journey(page);
  await j.boot("/", { beforeNavigate: beforeNeuralAuthNavigate });
  await waitNeuralAuthOwner(page, null);
  await signInNeuralAuthSDK(page, id, profile);
  // the training-day email ON, so Settings shows its row whether or not the Notifications tab is offered only to a player who has it
  // on (the hide-the-digest work, NG_DIGEST_LIVE); the address line is the subject here, not the switch
  await page.evaluate(() => (window as any).__neural.set("emailDigest", true));
  await j.land("Mount Top");
  return j;
};

test("signed in, the name, the initial and the address are printed only inside ph-no-capture marks: badge, menu, Settings", async ({ page }) => {
  const j = await signedIn(page, { email: EMAIL, name: NAME });
  if (!(await page.locator(".ngAcctChip").isVisible())) await j.clickByMouse(".ng-logo", "the drawer icon");
  await expect(page.locator(".ngAcctChip b")).toHaveText(NAME);
  await expect(page.locator(".ngAcctChip .ng-badge-av")).toHaveText(INITIAL);
  // a screen reader hears the badge as before: its accessible name is still its text (the avatar is aria-hidden, as it was)
  await expect(page.getByRole("button", { name: new RegExp("^" + NAME + " Today") })).toHaveCount(1);
  await expectNothingOutsideMarks(page, "the badge", NAME);

  await j.openAccountMenu("the signed-in badge");
  const row = page.locator(".ng-account-menu [data-menu-email]");
  await expect(row, "the menu's top row prints the address").toHaveText(EMAIL);
  await expect(row, "and still shows it as a tooltip").toHaveAttribute("title", EMAIL);
  await expectNothingOutsideMarks(page, "the open account menu", EMAIL);

  await j.clickByMouse("[data-menu-settings]", "Settings");
  await expect(page.locator("#ng-stab-notifications"), "Settings is up (its presentation loads on demand)").toBeVisible();
  await j.clickByMouse("#ng-stab-notifications", "Notifications in Settings");
  const line = page.locator("[data-digest-setting] > div > div").nth(1);
  await expect(line, "the line reads as it always did").toContainText("After a day you reviewed something: your techniques, your Game Knowledge, your streak — mailed to " + EMAIL + ".");
  await expectNothingOutsideMarks(page, "Settings, Notifications", EMAIL);
});

test("what autocapture reads for a mouse press on the badge, the name, the avatar, the menu's top row and Settings holds none of the identity, and the badge press is still counted", async ({ page }) => {
  const j = await signedIn(page, { email: EMAIL, name: NAME });
  if (!(await page.locator(".ngAcctChip").isVisible())) await j.clickByMouse(".ng-logo", "the drawer icon");

  let n = (await mirrorEvents(page)).length;
  await j.clickByMouse(".ngAcctChip", "the badge");
  counted(await pressed(page, n, "the badge"), "the badge");
  expect(await menuOpen(page)).toBe(true);

  n = (await mirrorEvents(page)).length;
  await j.clickByMouse(".ng-account-menu [data-menu-email]", "the menu's top row");
  const top = await pressed(page, n, "the menu's top row");
  expect(top.captured, "a press on the address row, which is not a control, is not sent at all").toBe(false);
  expect(await menuOpen(page), "the row is still not a control").toBe(true);

  // the name and the avatar are inert to the pointer, so the press lands on the badge itself
  for (const [sel, what] of [[".ngAcctChip b", "the name itself"], [".ngAcctChip .ng-badge-av", "the avatar's letter"]]) {
    const c = await centre(page, sel);
    expect(c.w, what + " is laid out").toBeGreaterThan(4);
    expect(c.inChip && !c.onMark, what + ": the point belongs to the badge, not to the mark").toBe(true);
    const was = await menuOpen(page);
    n = (await mirrorEvents(page)).length;
    await page.mouse.click(c.x, c.y);
    counted(await pressed(page, n, what), what);
    expect(await menuOpen(page), what + ": the press worked the badge").toBe(!was);
  }
  if (!(await menuOpen(page))) await j.openAccountMenu("the badge, again");

  // a row beside the address: the menu is in its chain, so nothing the menu itself carries may name the player
  n = (await mirrorEvents(page)).length;
  await j.clickByMouse("[data-menu-settings]", "Settings");
  expect((await pressed(page, n, "the menu's Settings row")).captured, "the Settings row is counted").toBe(true);
  await expect(page.locator("#ng-stab-notifications"), "Settings is up (its presentation loads on demand)").toBeVisible();
  await j.clickByMouse("#ng-stab-notifications", "Notifications in Settings");
  await expect(page.locator("[data-digest-setting] .ph-no-capture")).toHaveText(EMAIL);
  n = (await mirrorEvents(page)).length;
  await j.clickByMouse("[data-digest-setting] button", "the Training-day email's On");
  const on = await pressed(page, n, "Settings' On");
  expect(on.captured, "Settings' On is counted").toBe(true);
  const a = await page.evaluate(() => { const r = document.querySelector("[data-digest-setting] .ph-no-capture")!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  n = (await mirrorEvents(page)).length;
  await page.mouse.click(a.x, a.y);
  await pressed(page, n, "the address in Settings");
});

test.describe("on a phone, by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true });

  test("a real touch tap on the badge, the name and the menu's top row sends none of the identity, and the badge tap is counted", async ({ page }) => {
    const j = await signedIn(page, { email: EMAIL, name: NAME });
    const tap = async (sel: string) => { const c = await centre(page, sel); await page.touchscreen.tap(c.x, c.y); return c; };
    if (!(await page.locator(".ngAcctChip").isVisible())) await tap(".ng-logo");
    await expect(page.locator(".ngAcctChip")).toBeVisible();
    await expectNothingOutsideMarks(page, "the badge at 390x631", NAME);

    let n = (await mirrorEvents(page)).length;
    const c = await tap(".ngAcctChip b");
    expect(c.inChip && !c.onMark, "the name's point belongs to the badge").toBe(true);
    const ev = await pressed(page, n, "a tap on the name");
    expect(ev.pointerType, "a real touch tap").toBe("touch");
    counted(ev, "a tap on the name");
    await expect.poll(() => menuOpen(page), "the tap opened the menu").toBe(true);
    await expectNothingOutsideMarks(page, "the open menu at 390x631", EMAIL);

    n = (await mirrorEvents(page)).length;
    await tap(".ng-account-menu [data-menu-email]");
    expect((await pressed(page, n, "a tap on the menu's top row")).pointerType).toBe("touch");

    n = (await mirrorEvents(page)).length;
    await tap(".ngAcctChip");
    counted(await pressed(page, n, "a tap on the badge"), "a tap on the badge");
  });
});

test("an email-and-password account, whose name is the address's local part, is marked the same way", async ({ page }) => {
  const j = await signedIn(page, { email: ONLY_EMAIL, name: null }, "mask-email-only");
  if (!(await page.locator(".ngAcctChip").isVisible())) await j.clickByMouse(".ng-logo", "the drawer icon");
  await expect(page.locator(".ngAcctChip b"), "the app names the account by its local part").toHaveText(ONLY_LOCAL);
  await expectNothingOutsideMarks(page, "the badge", ONLY_LOCAL, EMAIL_ONLY);
  const c = await centre(page, ".ngAcctChip b");
  const n = (await mirrorEvents(page)).length;
  await page.mouse.click(c.x, c.y);
  counted(await pressed(page, n, "the local part itself", EMAIL_ONLY), "the local part itself");
  await expect.poll(() => menuOpen(page), "the press opened the menu").toBe(true);
  await expectNothingOutsideMarks(page, "the open account menu", ONLY_EMAIL, EMAIL_ONLY);
});
