---
title: "Half Guard Pass Position | BJJ Position Guide | BJJ Graph"
description: "Master Half Guard Pass Position in BJJ. Complete guide covering passing techniques, pressure control, and advancement from half guard top. Success rates: Beginner 45%, Intermediate 60%, Advanced 75%."

# State Machine Data (Machine-Readable)
state_machine:
  state_id: S232
  position_name: "Half Guard Pass Position"
  alternative_names: ["Half Guard Top", "Passing Half Guard", "Half Guard Control"]

  # Core Properties
  properties:
    point_value: 2
    position_type: "Offensive with passing focus"
    risk_level: "Medium"
    energy_cost: "Medium"
    time_sustainability: "Medium"

  # Success Metrics
  metrics:
    position_retention_rate:
      beginner: 45
      intermediate: 60
      advanced: 75
    advancement_probability:
      beginner: 50
      intermediate: 65
      advanced: 80
    submission_probability:
      beginner: 10
      intermediate: 20
      advanced: 30
    position_loss_probability:
      beginner: 40
      intermediate: 30
      advanced: 18
    average_time_in_position: "1-2 minutes"

  # State Machine Integration
  invariants:
    - "Opponent has one of your legs trapped between theirs"
    - "You are controlling opponent's upper body from top position"
    - "Your free leg is positioned for base and passing"

  # Available Transitions
  offensive_transitions:
    - technique: "Knee Slide Pass"
      target_state: "Side Control"
      transition_id: "T320"
      success_rate:
        beginner: 45
        intermediate: 60
        advanced: 75

    - technique: "Underhook Pass"
      target_state: "Side Control"
      transition_id: "T321"
      success_rate:
        beginner: 40
        intermediate: 55
        advanced: 70

    - technique: "Crossface Pass"
      target_state: "Side Control"
      transition_id: "T322"
      success_rate:
        beginner: 35
        intermediate: 50
        advanced: 65

    - technique: "Knee Cut from Half"
      target_state: "Side Control"
      transition_id: "T323"
      success_rate:
        beginner: 50
        intermediate: 65
        advanced: 78

    - technique: "Back Take from Half"
      target_state: "Back Control"
      transition_id: "T324"
      success_rate:
        beginner: 25
        intermediate: 40
        advanced: 55

  defensive_responses:
    - technique: "Sweep from Bottom"
      target_state: "Top Position"
      success_rate: 30

    - technique: "Lock Down"
      target_state: "Half Guard Bottom"
      success_rate: 35

    - technique: "Deep Half Entry"
      target_state: "Deep Half Guard"
      success_rate: 25

  # Decision Tree
  decision_tree:
    - condition: "Opponent is flat on back"
      options:
        - action: "Knee Slide Pass"
          target: "Side Control"
          probability: 60
        - action: "Crossface Pass"
          target: "Side Control"
          probability: 50

    - condition: "Opponent on side with underhook"
      options:
        - action: "Underhook Pass"
          target: "Side Control"
          probability: 55
        - action: "Back Take from Half"
          target: "Back Control"
          probability: 40

  # Energy & Cooking System
  energy_dynamics:
    maintainer_burn_rate: 2.2
    defender_burn_rate: 2.8
    explosive_escape_multiplier: 3.8
    cooking_rate: 2.0

  # Related States
  related_states:
    - "Half Guard Bottom"
    - "Side Control"
    - "Back Control"
    - "Mount"
---

<!-- Schema Markup omitted for brevity -->

# Half Guard Pass Position
#bjj #state #half-guard #top #passing

## State Properties
- **State ID**: S232
- **Point Value**: 2 (Advantage position)
- **Position Type**: Offensive with passing focus
- **Risk Level**: Medium
- **Energy Cost**: Medium
- **Time Sustainability**: Medium

## State Description
Half Guard Pass Position is the advantageous top position where you are working to pass your opponent's half guard. One of your legs is trapped between your opponent's legs, but you have established upper body control and are positioned to complete the pass to side control or mount. This is a critical juncture in BJJ where the battle between guard retention and passing is intensely contested.

From this position, you have earned partial control and points in most rule sets, but full passing requires freeing your trapped leg and establishing complete side control or mount. Success requires combining pressure, proper weight distribution, and systematic passing techniques while defending against sweeps and submissions from the bottom player.

### Visual Description
You are on top with your chest or shoulder applying downward pressure on your opponent while one of your legs is trapped between their legs in half guard. Your free leg provides base and posting ability while your trapped leg is working to extract itself. Your upper body is controlling opponent's head, arms, or torso with crossface, underhook, or other grips. The opponent is typically on their side or partially flattened, working to maintain the half guard and prevent the pass.

## Key Principles
- **Pressure and Weight Distribution**: Apply constant chest and shoulder pressure to flatten opponent
- **Underhook Control**: Secure underhooks to control opponent's upper body and prevent their mobility
- **Crossface Application**: Use crossface to turn opponent's head away and flatten them
- **Leg Extraction**: Systematically work to free trapped leg while maintaining upper body control
- **Base with Free Leg**: Use free leg for stability and driving power during passing attempts
- **Head Position**: Keep head tight to opponent to prevent them from creating frames

## Prerequisites
- Understanding of pressure passing principles
- Knowledge of half guard dynamics
- Upper body control techniques
- Balance and base fundamentals

## State Invariants
- Opponent has one of your legs trapped between theirs
- You are controlling opponent's upper body from top position
- Your free leg is positioned for base and passing

## Offensive Transitions
- [[Knee Slide Pass]] → [[Side Control]] (Success Rate: Beginner 45%, Intermediate 60%, Advanced 75%)
- [[Knee Cut Pass]] → [[Side Control]] (One of the most common and fundamental techniques to pass half guard)
- [[Underhook Pass]] → [[Side Control]] (Success Rate: Beginner 40%, Intermediate 55%, Advanced 70%)
- [[Crossface Pass]] → [[Side Control]] (Success Rate: Beginner 35%, Intermediate 50%, Advanced 65%)
- [[Knee Cut from Half]] → [[Side Control]] (Success Rate: Beginner 50%, Intermediate 65%, Advanced 78%)
- [[Back Take from Half]] → [[Back Control]] (Success Rate: Beginner 25%, Intermediate 40%, Advanced 55%)

## Expert Insights
**John Danaher**: "Half guard passing is fundamentally about control before movement. Many people try to extract their leg before establishing proper upper body control, which leads to sweeps and re-guards. First establish a heavy crossface and underhook control, flatten your opponent, then systematically work your leg free. The sequence matters enormously."

**Gordon Ryan**: "In competition, I use my shoulder and chest pressure to make half guard extremely uncomfortable. If I can make the bottom player tired and desperate to escape the pressure, they often make mistakes that allow easy passes. The key is being heavy and methodical, not rushing the extraction."

**Eddie Bravo**: "From the 10th Planet perspective, we're very aware of lockdown and deep half entries from this position. When passing half guard, I'm constantly monitoring the opponent's hooks and leg positions. If they start setting up lockdown or deep half, I adjust my base and sometimes switch to different passing angles completely."

## Common Errors
- **Error**: Rushing the leg extraction
  - **Consequence**: Leaves you off-balance and vulnerable to sweeps or deeper half guard entries.
  - **Correction**: Establish solid upper body control first, then work leg free systematically.
  - **Recognition**: If you frequently get swept or pulled into deep half, you're rushing.

- **Error**: Insufficient pressure
  - **Consequence**: Allows opponent to remain mobile and maintain effective half guard.
  - **Correction**: Keep chest and shoulder heavy on opponent, driving them flat to the mat.
  - **Recognition**: If opponent can easily turn to their side or create space, increase pressure.

## Training Drills
- **Pressure Maintenance Drill**: Hold half guard top with maximum pressure while partner tries to create space, 2-minute holds at 50-70% resistance.
- **Passing Sequence Drill**: Practice complete passing sequences from half guard top, 15 repetitions per technique with progressive resistance.
- **Positional Sparring**: Start from half guard top and work for pass while opponent works for sweeps, 5-minute rounds.

## Related States
- [[Half Guard Bottom]] - Opponent's perspective
- [[Side Control]] - Primary passing target
- [[Back Control]] - Alternative advancement
- [[Deep Half Guard]] - Risk position if opponent enters
- [[Mount]] - Advanced passing target

## Decision Tree
If opponent is flat on back:
- Execute [[Knee Slide Pass]] → [[Side Control]] (Probability: 60%)
- Or Execute [[Crossface Pass]] → [[Side Control]] (Probability: 50%)

Else if opponent on side with underhook:
- Execute [[Underhook Pass]] → [[Side Control]] (Probability: 55%)
- Or Execute [[Back Take from Half]] → [[Back Control]] (Probability: 40%)

## Position Metrics
- **Position Retention Rate**: Beginner 45%, Intermediate 60%, Advanced 75%
- **Advancement Probability**: Beginner 50%, Intermediate 65%, Advanced 80%
- **Submission Probability**: Beginner 10%, Intermediate 20%, Advanced 30%
- **Position Loss Probability**: Beginner 40%, Intermediate 30%, Advanced 18%
- **Average Time in Position**: 1-2 minutes
