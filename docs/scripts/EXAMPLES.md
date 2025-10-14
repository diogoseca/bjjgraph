# Schema Generation Examples

**Scripts Covered:**
- `add_transition_schema_v2.py` - Transition HowTo schema
- `add_position_schema_v2.py` - Position HowTo + FAQ schema

This document provides examples of how the V2 schema generation scripts work across different content formats.

---

## Transition Schema Examples (add_transition_schema_v2.py)

## Example 1: Standard Numbered Sequence Format

**File**: Butterfly Guard to X-Guard.md

**Source Content**:
```markdown
## Execution Steps
1. Establish proper butterfly guard position with both hooks inserted
2. Create upper body connection through collar, sleeve, or underhook control
3. Identify target leg (typically opponent's lead leg)
4. Initiate shallow leg control by shifting one butterfly hook higher on opponent's leg
5. Use opposite-side hook to control opponent's other leg temporarily
6. Extend target leg control by inserting foot across opponent's hip line
7. Transition second leg to form the "X" configuration around opponent's controlled leg
8. Solidify X-Guard with proper upper body connection and off-balancing grips
```

**Generated Schema**:
```json
{
  "@type": "HowTo",
  "name": "Butterfly Guard to X-Guard",
  "description": "Learn how to execute Butterfly Guard to X-Guard in Brazilian Jiu-Jitsu. Success: Beginner 35%, Intermediate 60%, Advanced 85%.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Establish proper butterfly guard",
      "text": "Establish proper butterfly guard position with both hooks inserted",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Create upper body connection",
      "text": "Create upper body connection through collar, sleeve, or underhook control",
      "position": 2
    }
    // ... 6 more steps
  ],
  "totalTime": "PT7M"
}
```

---

## Example 2: Visual Execution Sequence Format

**File**: Switch to Triangle.md

**Source Content**:
```markdown
## Visual Execution Sequence

Starting from a closed guard bottom position, you control your opponent's posture with 
a strong collar grip, pulling them down to prevent their escape, while they defend an 
initial armbar attempt by keeping their arms tight and posturing up, creating a momentary 
opening for the triangle switch. You shift your hips to create a perpendicular angle, 
breaking their alignment by moving your body to the side, using your left hand to secure 
their right wrist across their centerline, ensuring their arm is isolated for the setup...
```

**Generated Schema**:
```json
{
  "@type": "HowTo",
  "name": "Switch to Triangle",
  "description": "Learn how to execute Switch to Triangle in Brazilian Jiu-Jitsu from Closed Guard Bottom to Triangle Control. Success: Beginner 45%, Intermediate 70%, Advanced 85%.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "From the initial position",
      "text": "From the initial position like closed guard bottom, recognize the opponent's defensive structure and arm positioning, identifying a momentary lapse as they defend another threat.",
      "position": 1
    }
    // ... 7 more steps extracted from narrative
  ],
  "totalTime": "PT7M"
}
```

---

## Example 3: Plain List Format

**File**: Sprawl.md

**Source Content**:
```markdown
## Execution Steps
1. Begin in a Standing Position or Clinch Position, maintaining awareness of the opponent's movements
2. React instantly by dropping your hips downward and backward with explosive speed
3. Drive your chest and shoulders forward to apply pressure on their upper back or head
4. Keep your hips heavy and low to maintain control over your balance
5. Maintain control over their upper body with your hands or forearms during the transition
6. Complete the Sprawl by either pushing them away to reset to a Neutral Position
7. Ensure control over your base and position to prevent recovery or follow-up attacks
8. Remain aware of their defensive or offensive responses like chaining attacks
```

**Generated Schema**:
```json
{
  "@type": "HowTo",
  "name": "Sprawl",
  "description": "Learn how to execute Sprawl in Brazilian Jiu-Jitsu from Standing Position to Neutral Position. Success: Beginner 50%, Intermediate 65%, Advanced 80%.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Begin in a Standing",
      "text": "Begin in a Standing Position or Clinch Position, maintaining awareness of the opponent's movements and recognizing the initiation of a takedown attempt when they drop their level to attack your legs.",
      "position": 1
    }
    // ... 7 more steps
  ],
  "totalTime": "PT7M"
}
```

---

## Example 4: Minimal Content (Fallback)

**File**: Hypothetical file with minimal content

**Source Content**:
```markdown
# New Technique

## Transition Properties
- **Starting Position**: [[Closed Guard]]
- **Ending Position**: [[Mount]]
```

**Generated Schema** (Fallback):
```json
{
  "@type": "HowTo",
  "name": "New Technique",
  "description": "Learn how to execute New Technique in Brazilian Jiu-Jitsu from Closed Guard to Mount.",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Setup Position",
      "text": "Begin in Closed Guard position with proper control and grips established.",
      "position": 1
    },
    {
      "@type": "HowToStep",
      "name": "Execute Technique",
      "text": "Execute the New Technique technique with proper timing and body mechanics.",
      "position": 2
    },
    {
      "@type": "HowToStep",
      "name": "Complete Transition",
      "text": "Transition to Mount position and secure control.",
      "position": 3
    }
  ],
  "totalTime": "PT2M"
}
```

---

## Key Features Demonstrated

1. **Format Flexibility**: Handles 4 different content structures
2. **Intelligent Extraction**: Preserves step names and descriptions
3. **State Integration**: Uses Starting/Ending states in descriptions
4. **Success Rates**: Includes probability data when available
5. **Time Estimation**: Adjusts based on number of steps
6. **Fallback Logic**: Creates valid schema even with minimal content
7. **Text Truncation**: Limits descriptions to 300 chars for schema compliance
8. **Position Numbering**: Maintains proper step sequence

## Schema Validation

All generated schemas follow:
- schema.org HowTo specification
- Google's structured data guidelines
- Best practices for BJJ instruction documentation
- Consistent formatting across all 70 files
