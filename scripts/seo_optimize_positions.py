#!/usr/bin/env python3
"""Temporary script: AI SEO optimization for Body Lock and Leg Drag Position JSON files."""
import json
import os

BODY_LOCK_PATH = "source/content/Positions/Body Lock.json"
LEG_DRAG_PATH = "source/content/Positions/Leg Drag Position.json"

# ─────────────────────────────────────────────
# BODY LOCK — new overview texts
# ─────────────────────────────────────────────
BODY_LOCK_HUB_OVERVIEW = (
    "**Body Lock** is a dominant standing clinch control position in BJJ where you wrap both arms around your "
    "opponent's torso and lock your hands together, creating a closed kinetic chain that transfers body weight and "
    "pressure directly into your opponent's center of gravity. Back take success rate from body lock: Beginner 50%, "
    "Intermediate 65%, Advanced 80%. Body lock is legal in all major BJJ and grappling competitions "
    "(IBJJF, ADCC, EBI) — it is a control position, not a submission hold.\n\n"
    "The position exists in two distinct strategic contexts: from behind (where you control their back while "
    "standing and threaten mat returns to [[Back Control]]), and from the side or front (where you establish "
    "over-under or double underhook configurations to execute throws, takedowns, and transitions to dominant ground "
    "positions). The body lock creates a unified control mechanism that eliminates the opponent's ability to create "
    "distance or establish defensive grips. When executed correctly, the locked grip becomes redundant insurance "
    "while your chest-to-back connection and hip pressure provide the primary control. This mechanical advantage "
    "allows smaller grapplers to control larger opponents and forces the bottom player into a series of bad choices "
    "where they must simultaneously defend multiple threats.\n\n"
    "The position is inherently transitional and requires immediate attack execution. Hesitation allows opponents "
    "time to establish defenses, break grips, or escape entirely. Modern no-gi competition has elevated the body "
    "lock to a primary offensive weapon, with elite competitors using it to consistently secure back control, "
    "execute high-amplitude throws, or force opponents into defensive positions that lead to dominant ground "
    "control. Mastery requires understanding weight distribution, hip positioning, timing, and the ability to read "
    "opponent defensive reactions to capitalize on openings as they appear.\n\n"
    "Body Lock Pass — Ground-Based Application: While the standing body lock controls an upright opponent, the "
    "[[Body Lock Pass]] applies the same locked-grip mechanic from top position against a guard player on the "
    "ground. The top practitioner wraps both arms around the bottom player's torso and uses chest and hip pressure "
    "to drive past their guard into [[Side Control]] or [[Turtle]]. This is a closely related but distinct concept "
    "that bridges standing and ground applications of body lock control. When combined with [[Leg Drag Position]], "
    "the leg drag controls the hip while the body lock secures the torso, creating an especially difficult-to-escape "
    "passing system. See [[Bodylock Pass]] for the complete guard-passing application.\n\n"
    "How Does Body Lock Lead to Back Control? From body lock, [[Back Control]] is achieved via mat return: drive "
    "hip pressure into the opponent, force them to [[Turtle]] or break posture backward, then secure the back with "
    "hooks. When the opponent turtles to defend the mat return, immediately transition to [[Crab Ride]] to maintain "
    "back exposure while inserting hooks. The highest-percentage sequence is Body Lock to [[Turtle to Back Control]] "
    "to [[Seat Belt Control Back]] to [[Rear Naked Choke]]. Elite no-gi competitors achieve 70-80% back-take "
    "success from body lock at the advanced level.\n\n"
    "Body Lock vs Rear Clinch — What Is the Difference? The [[Standing Rear Clinch]] involves chest-to-back "
    "connection with wrist or bicep control. The body lock advances this by locking both hands completely around "
    "the torso, creating a closed kinetic chain. The body lock offers higher control and more direct back-take "
    "paths but requires closer proximity and committed grip fighting to establish from the [[Clinch]]. The "
    "[[Overhook Control]] and [[Double Unders]] are related grip configurations that offer different trade-offs "
    "in control versus versatility.\n\n"
    "What Throws Can You Do from Body Lock? Common throws include hip toss, inside trip, outside trip, and suplex "
    "variations. Throw selection depends on the opponent's defensive reaction: an upright posture creates throw "
    "opportunities while a postured or sprawling posture creates mat return and back-take opportunities. Trip and "
    "[[Double leg takedown]] combinations offer the highest percentage for beginners. The [[Snap Down]] to "
    "[[Front Headlock]] is effective when the opponent lowers their level to defend hip pressure.\n\n"
    "Body Lock in Wrestling vs BJJ: In wrestling, the body lock (also called a bear hug) is a clinch control used "
    "for lifts, throws, and mat returns. BJJ evolved the body lock into a systematic back-control entry system, "
    "adding hook insertion, [[Crab Ride]] transitions, and submission sequences extending well beyond wrestling "
    "applications. Modern no-gi grappling methodology has built comprehensive body lock systems that chain mat "
    "returns to back control with reproducible consistency, making the body lock one of the defining positions "
    "of elite no-gi competition."
)

BODY_LOCK_BOTTOM_OVERVIEW = (
    "Body Lock Bottom is a highly disadvantageous defensive position where your opponent has wrapped both arms "
    "around your torso with hands locked together, controlling your movement and setting up immediate threats of "
    "back takes, throws, or mat returns. This position requires urgent defensive action — it represents one of the "
    "most dominant forms of standing control in grappling. Your opponent has eliminated your ability to create "
    "distance, established connection to your center of mass, and can execute multiple high-percentage attacks "
    "within seconds.\n\n"
    "How to Escape the Body Lock — Step-by-Step: (1) Fight hands the instant your opponent attempts to connect — "
    "prevention is far easier than escape once the lock is fully established. (2) Post both hands on your "
    "opponent's hips and drive them away explosively while simultaneously widening your base. (3) Bend your knees "
    "and lower your center of gravity to resist their hip pressure and prevent backward posture breaking. (4) If "
    "the grip is fully locked, attack inward at their wrist junction using a hip-pivot motion to find a gap. "
    "(5) Never turn away from your opponent — turning gives up your back immediately. (6) If standing escape is "
    "failing within 2-3 seconds, proactively sit to [[Closed Guard]] — control your landing rather than being "
    "thrown. (7) From guard, establish grips and look to set up [[Triangle Setup]] or [[Arm Drag to Back]] "
    "sequences to reverse the exchange.\n\n"
    "From bottom, your primary objectives are: breaking your opponent's locked grip, creating space to establish "
    "defensive frames, preventing your posture from breaking backward, and escaping to neutral standing position "
    "or guard. The longer you remain in this position, the more your opponent can tire you out, break your posture, "
    "and execute their preferred takedown or back take. Understanding [[Grip Breaking]] principles, hip positioning "
    "for space creation, and recognizing when to sit to [[Closed Guard]] versus when to fight for standing "
    "position is critical for effective defense.\n\n"
    "When Should You Sit to Guard vs Fight Standing? Fighting for standing position is correct when the lock is "
    "not fully established, when hip-posting space is available, or when you have a significant athletic advantage. "
    "Sitting to [[Closed Guard]] is correct when: (a) the lock is fully established and your posture is breaking, "
    "(b) your opponent is actively lifting or driving you forward, (c) you feel a throw or suplex being initiated. "
    "A controlled guard pull is strategically superior to being thrown — you dictate the ground position rather "
    "than landing on your opponent's terms with their momentum advantage.\n\n"
    "The body lock bottom position appears frequently in no-gi competition when opponents establish dominant clinch "
    "control or when you are caught during scrambles and transitions. Developing competent defenses prevents "
    "opponents from consistently taking your back or scoring takedowns, which is essential at all competitive "
    "levels. At the advanced level, skilled practitioners treat the body lock bottom as a position of strategic "
    "choice — sitting to guard with deliberate intent to use their bottom guard system rather than passively "
    "accepting the throw."
)

BODY_LOCK_TOP_OVERVIEW = (
    "Body Lock Top is one of the most dominant control positions in standing grappling, where you wrap both arms "
    "completely around your opponent's torso and lock your hands together, creating unified control over their "
    "center of mass and movement. This position provides immediate pathways to [[Back Control]] through mat "
    "returns, throwing techniques, or transitions to other dominant ground positions. The body lock eliminates your "
    "opponent's ability to create distance, establish defensive grips, or execute their own offensive techniques, "
    "forcing them into a series of defensive choices where all options lead to disadvantageous positions.\n\n"
    "How to Set Up Body Lock from Standing — Step-by-Step: (1) Establish chest-to-back connection from the "
    "[[Standing Rear Clinch]] or a [[Clinch]] exchange — create the angle before attacking the grip. "
    "(2) Shoot both arms simultaneously around your opponent's torso during a grip-fighting exchange or when their "
    "defensive frames break — speed is critical as they will fight the connection. (3) Lock your hands at their "
    "centerline immediately using a gable grip, rear naked choke grip, or S-grip — delay allows defensive hand "
    "fighting to develop. (4) Drive your chest firmly into their back, eliminating all space between bodies. "
    "(5) Position your head to the underhook side with your temple against their shoulder area to prevent head "
    "control attempts and enhance your throwing angle. (6) Drive hips forward with progressive pressure to break "
    "their posture backward. (7) Within 1-2 seconds, choose your attack based on their defensive reaction: mat "
    "return to [[Back Control]] if they break posture, throw to [[Side Control]] if they resist upright, or "
    "[[Snap Down]] to [[Front Headlock]] if they lower their level.\n\n"
    "The effectiveness of the body lock stems from its biomechanical superiority — by creating a closed kinetic "
    "chain with locked hands and chest-to-back connection, you transfer force from your legs through your hips "
    "directly into your opponent's center of gravity with maximum efficiency. This mechanical advantage allows you "
    "to control when and how the engagement goes to the ground, which is the fundamental objective of all standing "
    "grappling exchanges. Your opponent must simultaneously defend against back takes, throws, and mat returns but "
    "cannot effectively defend all three, creating a forced decision tree where every defensive choice opens a "
    "different offensive pathway.\n\n"
    "Modern no-gi competition has elevated the body lock to a primary offensive weapon, with elite competitors "
    "using systematic approaches to establish this control and transition to dominant ground positions. The "
    "[[Crab Ride]] serves as a critical bridge when the opponent turtles to defend the mat return — maintaining "
    "back exposure while you insert hooks for [[Seat Belt Control Back]] and ultimately [[Rear Naked Choke]]. The "
    "position requires proper execution of grip mechanics, hip pressure, chest connection, and immediate attack "
    "timing to maximize effectiveness before opponents can establish defensive measures."
)

# ─────────────────────────────────────────────
# LEG DRAG POSITION — new overview texts
# ─────────────────────────────────────────────
LEG_DRAG_HUB_OVERVIEW = (
    "**Leg Drag Position** is a dominant passing control in BJJ where the top player controls one of the "
    "opponent's legs and drags it across their body, disrupting guard structure while applying chest pressure to "
    "pin the hip. Pass completion rate: Beginner 40-55%, Intermediate 60-70%, Advanced 75-85%. The leg drag is "
    "especially effective in no-gi BJJ where grip-based guard defenses are unavailable — and is a cornerstone "
    "of modern elite no-gi passing systems.\n\n"
    "The leg drag represents a critical transitional state where the top practitioner has successfully controlled "
    "one of the bottom player's legs and dragged it across their body, disrupting the guard structure while "
    "maintaining a strategic angle of attack. This position creates multiple offensive opportunities including "
    "direct passes to [[Side Control]], transitions to the back, and [[Knee Slice Pass]] variations.\n\n"
    "From the top perspective, the leg drag offers exceptional control with relatively low energy expenditure. The "
    "key mechanical advantage comes from controlling the opponent's hip and leg simultaneously, preventing their "
    "ability to create frames or recover guard. The top player can apply significant pressure through their chest "
    "and shoulder while maintaining mobility to react to escape attempts. The position naturally facilitates "
    "progression to more dominant positions, as the bottom player's defensive options are severely limited by the "
    "compromised hip position.\n\n"
    "From the bottom perspective, the leg drag represents a dangerous situation requiring immediate and decisive "
    "action. The bottom player must recognize the position early and choose between attempting to recover guard "
    "structures ([[Butterfly Guard]], [[De La Riva Guard]], or [[Half Guard]]) or creating scrambles to establish "
    "neutral positions. The primary danger lies in allowing the pass to complete or exposing the back, both of "
    "which result from passive defense. Understanding the biomechanics of the position allows skilled practitioners "
    "to exploit the top player's weight distribution and create escape opportunities.\n\n"
    "Who Invented the Leg Drag Pass? The leg drag pass was popularized in modern sport BJJ by the Miyao brothers "
    "(Paulo and Joao), the Mendes brothers (Rafael and Guilherme), and competitors like Lucas Lepri. It evolved "
    "from traditional gi passing but gained prominence in no-gi grappling where leg control is especially "
    "effective without grip-based defenses. The position has been further systematized by Gordon Ryan and Lachlan "
    "Giles as a cornerstone of elite-level no-gi passing. The [[Leg Drag Pass]] is the technique that "
    "establishes this position.\n\n"
    "How Do You Enter the Leg Drag? The most common entry is from [[Headquarters Position]] (penetration step): "
    "the top player uses a penetration step inside the opponent's legs, grips one leg at the knee or ankle, drags "
    "it across the body while applying shoulder pressure, and establishes the leg drag control angle. Other "
    "entries include: [[Butterfly Guard]] passing (control one hook, drag), [[De La Riva Guard]] passing (collapse "
    "the hook and drag the leg across), and [[X-Guard]] passing (strip the leg and drag). The leg drag can also "
    "be combined with [[Body Lock]] for enhanced torso control.\n\n"
    "What Is the Difference Between Leg Drag and Leg Weave? The leg drag controls one leg and drags it across the "
    "body using chest pressure to pin the hip. The [[Leg Weave Pass]] involves weaving the opponent's leg and "
    "pinning it with your own leg or hip for a pressure pass. Both disrupt guard structure, but the leg drag "
    "creates back-take opportunities when the opponent turns away, while the leg weave is primarily a direct "
    "pressure pass to [[Side Control]].\n\n"
    "How Does Leg Drag Lead to Back Control? When the bottom player turns away from leg drag chest pressure to "
    "protect their guard or escape, the top player immediately executes a back step — stepping around the "
    "opponent's hips. This back step converts to back control at approximately 70-75% success rate at the "
    "intermediate-to-advanced level. Recognizing the turn-away is the critical cue — see the decision tree in "
    "Leg Drag Position Top for the full reaction sequence.\n\n"
    "The leg drag has become increasingly prominent in high-level competition due to its effectiveness against "
    "modern guard systems. It bypasses many traditional guard retention mechanisms by controlling the legs "
    "directly rather than dealing with grips and frames first. This makes it particularly effective against "
    "practitioners who rely heavily on distance management and leg-based guards. The position also scales well "
    "with skill level — beginners can use it for basic passing while advanced practitioners chain it into complex "
    "sequences involving back takes and submission threats.\n\n"
    "Historically, the leg drag evolved from traditional gi passing but has found even greater application in "
    "no-gi grappling where grip-based defenses are absent. The position continues to evolve with new variations "
    "emerging regularly, including the [[Body Lock]] pass connection, [[Headquarters Position]] integration, and "
    "leg drag to back take sequences that have become staples of modern grappling."
)

LEG_DRAG_BOTTOM_OVERVIEW = (
    "Being on bottom in the leg drag position is one of the most challenging defensive scenarios in Brazilian "
    "Jiu-Jitsu. The position represents a critical moment where your guard structure has been compromised and your "
    "opponent has achieved a dominant angle with control over your hip and leg. Understanding the mechanics of "
    "escape and prevention is essential for any practitioner looking to develop a complete defensive game.\n\n"
    "How to Escape the Leg Drag — Step-by-Step: (1) Recognize the position early — prevention is far easier than "
    "escape. The moment your opponent begins controlling your leg, start your defensive sequence. (2) Never turn "
    "away from your opponent — turning exposes your back immediately for an easy back take. (3) Create frames "
    "immediately with your free leg and far side arm — a shin frame against their shoulder and an arm frame "
    "against their hip creates temporary space. (4) Target recovery to [[Butterfly Guard]] as your primary "
    "objective: fight to get your free leg's heel behind their thigh to create a butterfly hook. (5) If butterfly "
    "recovery is blocked, seek [[Knee Shield Half Guard]] by threading your trapped leg between your bodies. "
    "(6) Use [[Granby Roll Concept]] when direct recovery is blocked and their balance is compromised: roll "
    "backward over your near shoulder, inverting your hips underneath to reset your guard structure — typically "
    "recovering to [[Butterfly Guard]]. (7) Act within 3-4 seconds — late defense rarely succeeds as the top "
    "player consolidates.\n\n"
    "The fundamental problem from bottom is that your hip has been controlled and one leg has been dragged across "
    "your body, eliminating many of your primary defensive tools. Your ability to create frames, maintain distance, "
    "and use your legs for guard retention has been severely compromised. The top player can apply significant "
    "pressure while maintaining the mobility to address your escape attempts. This asymmetry in position quality "
    "means defensive actions must be immediate, decisive, and technically precise.\n\n"
    "When choosing between escape options: attempt [[Butterfly Guard]] recovery when the top player's chest "
    "pressure is present but they have not secured an underhook; attempt [[Deep Half Guard]] entry when their "
    "weight is heavy and forward; use [[Granby Roll Concept]] when their balance is compromised by their own "
    "pressure; seek [[Knee Shield Half Guard]] when they begin the back step motion. Each option requires precise "
    "timing and full commitment — hesitation almost always results in further positional deterioration.\n\n"
    "Advanced practitioners develop sensitivity to the weight distribution and pressure patterns in the leg drag, "
    "allowing them to exploit moments of adjustment or transition. The goal is not merely to survive but to "
    "actively threaten reversals or sweeps that make the top player adjust their position, creating windows for "
    "guard recovery. Understanding the connection between the leg drag and back exposure is critical — you must "
    "never turn away from your opponent as this immediately exposes your back for taking."
)

LEG_DRAG_TOP_OVERVIEW = (
    "The leg drag position from top is one of the most powerful and versatile passing positions in modern "
    "Brazilian Jiu-Jitsu. It represents a critical juncture where you have successfully controlled your opponent's "
    "leg and hip, creating a dominant angle that facilitates multiple high-percentage passing and back-taking "
    "opportunities. The position's effectiveness lies in its ability to simultaneously restrict the bottom "
    "player's defensive options while maintaining your mobility and offensive initiative.\n\n"
    "How to Execute the Leg Drag Pass — Step-by-Step: (1) Establish initial leg control from [[Headquarters "
    "Position]], guard breaking, or scramble — grip one leg at the knee or ankle. (2) Drag the controlled leg "
    "across your opponent's body toward the mat while moving perpendicular to their torso. (3) Apply chest or "
    "shoulder pressure to the dragged leg to pin their hip — this is the defining mechanical action of the "
    "position. (4) Control the far hip with your free hand or head pressure to prevent [[Granby Roll Concept]] "
    "and inversions. (5) Read their defensive reaction immediately: if they stay flat, finish with [[Knee Slice "
    "Pass]] or [[Pressure Pass]] to [[Side Control]]; if they turn away even slightly, execute the back step "
    "immediately. (6) For the back step: release leg pressure, step your leg around their hips, and secure "
    "[[Back Control]] — this is 70-75% successful when timed correctly. (7) If they attempt a butterfly hook "
    "with their free leg, react immediately with an angled [[Knee Slice Pass]] to cut off the hook before "
    "it forms.\n\n"
    "The fundamental mechanics involve dragging one of the opponent's legs across their body while maintaining "
    "chest pressure and hip control. This configuration creates a powerful mechanical advantage where you can "
    "apply significant pressure while the opponent's ability to create frames, maintain distance, or recover guard "
    "is severely compromised. The angle you create by moving perpendicular to their body is crucial — it prevents "
    "them from turning into you while setting up direct paths to [[Side Control]], [[Mount]], or the back.\n\n"
    "The position requires careful pressure management and positional awareness. Too much commitment to chest "
    "pressure without controlling the far hip allows granby rolls or inversions. Insufficient pressure allows the "
    "bottom player to create butterfly hooks or recover [[Half Guard]]. The sweet spot involves maintaining enough "
    "pressure to restrict movement while staying mobile enough to react to escape attempts. Advanced applications "
    "involve chaining the leg drag with [[Body Lock]] for enhanced control, and developing automatic recognition "
    "of the turn-away signal for immediate back takes.\n\n"
    "Competitors like Lucas Lepri, the Miyao brothers, and Lachlan Giles have demonstrated the position's "
    "effectiveness at the highest levels, developing variations that continue to evolve the technique. "
    "Understanding the leg drag from top is essential for any practitioner looking to develop a complete modern "
    "passing game, particularly in no-gi settings where grip-based guard defenses are unavailable and hip "
    "control is the primary passing currency."
)


def update_body_lock():
    with open(BODY_LOCK_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    data['overview'] = BODY_LOCK_HUB_OVERVIEW
    data['bottom']['overview'] = BODY_LOCK_BOTTOM_OVERVIEW
    data['top']['overview'] = BODY_LOCK_TOP_OVERVIEW

    with open(BODY_LOCK_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Updated: {BODY_LOCK_PATH}")


def update_leg_drag():
    with open(LEG_DRAG_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    data['overview'] = LEG_DRAG_HUB_OVERVIEW
    data['bottom']['overview'] = LEG_DRAG_BOTTOM_OVERVIEW
    data['top']['overview'] = LEG_DRAG_TOP_OVERVIEW

    # Fix broken wikilinks in related_content
    for item in data['bottom']['related_content']:
        if item['name'] == 'Frame Creation':
            item['name'] = 'Defensive Frame'

    for item in data['top']['related_content']:
        if item['name'] == 'Guard Passing Principles':
            item['name'] = 'Guard Passing'

    with open(LEG_DRAG_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Updated: {LEG_DRAG_PATH}")


if __name__ == '__main__':
    update_body_lock()
    update_leg_drag()
    print("Done.")
