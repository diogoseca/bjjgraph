// Real-shaped technique content modeled on bjjgraph.org content/ md pages.
// Two entry shapes:
//   (A) LEGACY single-perspective (positions / simple moves): { cat, role, def, steps[], principles[],
//       decisionTree[], mistakes[], counters[], metrics{} } — keyed "<Family>|<Role>".
//   (B) RICH transition/submission/position with dual perspective: { cat, from, target, successRate,
//       def, context (SEO prose), outcomes[], variations[], related[], perspectives:{attacker,defender} }
//       — keyed by the technique name (splitName(t).main), perspective chosen in the UI.
// Defender blocks are authored one-by-one (authored:true). Unauthored perspectives/nodes fall back to a
// generated overview plus a pointer to the full bjjgraph.org breakdown — we deliberately do NOT clone this
// Rear Triangle to Armbar case onto every other transition.
window.NG_CONTENT = {
  decks: {
    // ---------- RICH EXEMPLAR (dual perspective) ----------
    "Rear Triangle to Armbar": {
      cat: "Transition",
      from: "Rear Triangle",
      target: "Armbar Control",
      successRate: 55,                 // intermediate baseline; rises with drilling
      def: "From the rear triangle — your legs figure-foured around the neck and one trapped arm while you ride the back — you abandon the strangle and rotate to isolate the trapped arm, swinging a leg across the face to drop into armbar control. The triangle that threatened the neck becomes the structure that traps the arm.",
      // Indexable overview paragraph (SEO / AEO / GEO). Always rendered on the page.
      context: "The Rear Triangle to Armbar is a high-percentage attack chain that converts back-triangle control into a finishing armbar. When an opponent defends the rear triangle choke by hiding the chin or fighting the hands, the trapped arm becomes the higher-percentage target: rotating the hips and swinging a leg over the head isolates the elbow for a textbook armbar. It is the canonical example of attacking in chains — the threat the opponent defends is exactly the door to the next submission.",
      outcomes: [
        { result: "Armbar finish", position: "Armbar Control", prob: 55, tone: "good" },
        { result: "Re-secure the back", position: "Rear Triangle", prob: 28, tone: "mid" },
        { result: "They free the arm & turn", position: "Turtle / Guard", prob: 17, tone: "bad" }
      ],
      variations: [
        "Belly-down armbar finish when they stack or roll — follow them face-down and finish prone.",
        "Re-triangle: if the arm slips, recover the figure-four and go back to the strangle.",
        "Switch to the far-side armbar if they hitchhiker-escape the near arm."
      ],
      related: ["Rear Triangle Choke", "Bow and Arrow Choke from Rear Triangle", "Armbar Control", "Back Take from Armbar"],
      // Film-study clips — the triangle→armbar chain. Rear-triangle-specific footage is rarer; these
      // teach the same mechanic (abandon the strangle, isolate the arm). Real, embeddable YouTube IDs.
      clips: [
        { id: "lvaEerT_LE8", start: 0, end: 22, vertical: true, title: "Triangle to armbar", by: "ADCC" },
        { id: "Y0LsaUhyiYs", start: 0, vertical: false, title: "Triangle \u2192 armbar details", by: "Bellingham BJJ" },
        { id: "6qiaGv5W--U", start: 0, vertical: false, title: "Triangle \u2194 armbar chain" }
      ],
      perspectives: {
        attacker: {
          summary: "You already own the rear triangle and the trapped arm. Stay heavy on the figure-four, isolate the elbow, then rotate and swing the leg across the face to drop into armbar control.",
          prerequisites: [
            "A locked rear triangle (figure-four around neck + one arm in).",
            "Control of the trapped-side wrist or sleeve so the elbow can't slip.",
            "Your hips already angled toward the trapped arm, not square behind them."
          ],
          steps: [
            "Pin the trapped arm to your chest — kill the elbow before you move.",
            "Open the figure-four slightly and rotate your hips toward the trapped-arm side.",
            "Swing your free leg over the head and across the face.",
            "Fall back controlling the wrist, knees pinched, thumb up.",
            "Finish with a slow hip lift into armbar control."
          ],
          principles: [
            "Angle before extension — pivot perpendicular to the arm before lifting the hips.",
            "Keep the elbow above your hip line so the joint, not the shoulder, takes the lever.",
            "Stay heavy on the head the entire rotation so they can't spin out.",
            "Thumb-up wrist control aligns the elbow for a clean break."
          ],
          counters: [
            "They hide the hand / hitchhiker-escape — switch to the belly-down armbar and follow.",
            "They stack to relieve pressure — drop belly-down and walk your hips out.",
            "They strip a leg — re-pommel to the figure-four and reset the threat."
          ],
          mistakes: [
            { err: "Swinging the leg before the elbow is pinned", fix: "Trap the wrist and kill the elbow first — only then rotate." },
            { err: "Finishing square, behind them", fix: "Pivot perpendicular so the lever lands on the elbow, not the shoulder." },
            { err: "Cranking fast for the tap", fix: "Extend slowly off the hips — speed loses control and risks the joint." }
          ]
        },
        defender: {
          authored: true,
          summary: "You're caught in the rear triangle and they're hunting the arm. Protect the trapped elbow, deny the angle, and use the moment they switch from neck to arm as your window to escape.",
          recognition: [
            "Their squeeze on the neck loosens as they rotate toward your trapped arm.",
            "A leg starts to travel over your head — the strangle is becoming an armbar.",
            "They reach for your wrist or sleeve to isolate the elbow."
          ],
          principles: [
            "Hide the hand — connect your trapped hand to your own collar or belt so the elbow can't be isolated.",
            "Deny the angle — keep turning into them so they can't get perpendicular.",
            "Keep the elbow bent and tight to your centerline; a straight arm is a finished armbar.",
            "Escape on their transition, not while the triangle is locked."
          ],
          options: [
            { move: "Hide-the-hand defense", when: "Before the leg clears your head", leadsTo: "Stalls the armbar — back to rear triangle pressure" },
            { move: "Hitchhiker escape", when: "As the arm starts to straighten", leadsTo: "Spin out to turtle / quarter guard" },
            { move: "Stack & spin", when: "The instant their leg crosses your face", leadsTo: "Free the head, recover guard" }
          ],
          bestOutcomes: [
            "Recover to turtle with the arm intact (~40%).",
            "Survive and force them back to the strangle, buying time (~30%)."
          ],
          mistakes: [
            { err: "Yanking the trapped arm straight out", fix: "Pulling against the lever feeds the armbar — bend the elbow and connect the hand instead." },
            { err: "Waiting passively in the triangle", fix: "Escape on their switch from neck to arm — the locked triangle is the worst time to move." },
            { err: "Turning away from them", fix: "Turn into them to deny the perpendicular angle the armbar needs." }
          ]
        }
      }
    },

    // ---------- LEGACY single-perspective entries ----------
    "Closed Guard|Bottom": {
      cat: "Position", role: "Bottom",
      def: "You control your opponent from underneath, legs wrapped around their waist with ankles crossed behind their back. Despite being on the bottom, this is an offensive platform: locked legs control their hips while your grips break posture and open sweeps and submissions.",
      principles: [
        "Keep constant hip connection — eliminate space so they can't posture or pass.",
        "Break posture with collar/sleeve grips plus heels driving into the lower back.",
        "Shift hips to 30–45° angles to off-balance and expose their base.",
        "Threaten two attacks at once so defending one opens the other."
      ],
      decisionTree: [
        { cond: "They posture up tall, hands on your hips", acts: [["Hip Bump Sweep", 60, "Mount"], ["Scissor Sweep", 55, "Mount"]] },
        { cond: "They drive forward to flatten you", acts: [["Pendulum Sweep", 55, "Mount"], ["Flower Sweep", 50, "Mount"]] },
        { cond: "They put an arm inside to start a pass", acts: [["Triangle Setup", 50, "Triangle"], ["Omoplata Sweep", 45, "Side Control"]] }
      ],
      mistakes: [
        { err: "Staying flat and square", fix: "Constantly shift hips to 30–45° to disrupt posture and open attacks." },
        { err: "Chasing one attack at a time", fix: "Chain — triangle to armbar, hip-bump to pendulum — so defense opens the next." },
        { err: "Crossing ankles too high or low", fix: "Cross at the small of their back, just above the hips, for max control." }
      ],
      metrics: { "Retention": "68%", "Sweep / advance": "62%", "Submission": "42%" }
    },
    "Scissor Sweep|Attacker": {
      cat: "Transition", role: "Attacker",
      def: "From closed or open guard you scissor your legs — one shin across the belt line, the other chopping the near leg — while pulling their upper body across, tipping them over to mount.",
      steps: [
        "Break posture and get an angle ~45° to your opponent.",
        "Collar/sleeve grip to pull their weight forward over their knees.",
        "Top shin across the belt line, bottom leg chops low.",
        "Pull and scissor simultaneously, come up to mount."
      ],
      principles: [
        "Angle first — square-on kills the leverage.",
        "Break posture so their weight is already forward.",
        "Shin sits across the belt line, not the chest.",
        "Sync the grip pull with the leg scissor."
      ],
      mistakes: [
        { err: "Sweeping square, no angle", fix: "Create a 45° angle before scissoring." },
        { err: "Pushing leg too high on the chest", fix: "Place the shin across the lower abdomen / belt line." },
        { err: "Pull and scissor out of sync", fix: "Time the upper-body pull to the exact instant you scissor." }
      ],
      counters: ["They post the free hand — switch to a kimura or hip-bump.", "They base out wide — take the back off the post."]
    },
    "Triangle Choke|Attacker": {
      cat: "Submission", role: "Attacker",
      def: "A strangle using your legs: one of their arms in, one out, your legs forming a figure-four around their neck and trapped shoulder, cutting the carotids.",
      clips: [
        { id: "rM8HMq3o9yY", start: 0, end: 26, vertical: true, title: "Triangle from closed guard", by: "Nicholas Meregali" },
        { id: "MbdpOmzThpQ", start: 0, vertical: false, title: "Surprising triangle from guard", by: "Giancarlo Bodoni" },
        { id: "9pjdpFCr4UI", start: 0, vertical: false, title: "No-gi triangle from guard", by: "Chewjitsu" },
        { id: "aR7JafPJ1lw", start: 0, vertical: false, title: "Triangle off the overhook", by: "Jon Thomas \u00b7 Grapplearts" }
      ],
      steps: [
        "Control one arm in, one out; break posture down.",
        "Shoot a leg over the neck and trapped shoulder.",
        "Lock the figure-four, angle off ~45°.",
        "Pull the head, squeeze knees, finish."
      ],
      principles: [
        "Angle is everything — pivot perpendicular to finish.",
        "Cut the far shoulder across the centerline.",
        "Control the posture before locking the legs.",
        "Pull the head down, don't just squeeze."
      ],
      mistakes: [
        { err: "Finishing square-on", fix: "Create an angle ~45° so the choke aligns on the neck." },
        { err: "Their arm slips out", fix: "Pin the trapped arm across your body before locking." },
        { err: "Only squeezing knees", fix: "Pull the head and curl, don't rely on leg squeeze alone." }
      ],
      counters: ["They posture up — break it back down or switch to armbar.", "They stack — angle off and re-pommel."]
    }
  }
};
