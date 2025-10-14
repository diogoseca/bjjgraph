---
title: BJJ State Machine
---


<!-- Schema Markup for SEO -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "BJJ State Machine",
  "description": "This file serves as documentation for the BJJ State Machine Canvas visualization. To view the canvas, click on the filename in Obsidian's file explorer and select \"Open as canvas\" or create a new c...",
  "url": "https://bjjgraph.com",
  "isPartOf": {
    "@type": "WebSite",
    "name": "BJJ Graph",
    "url": "https://bjjgraph.com"
  }
}
</script>

# BJJ State Machine Canvas
#bjj #system #visualization #canvas

This file serves as documentation for the BJJ State Machine Canvas visualization. To view the canvas, click on the filename in Obsidian's file explorer and select "Open as canvas" or create a new canvas and manually add the nodes described below.

## Canvas Overview

The BJJ State Machine Canvas provides a complete visual representation of the Brazilian Jiu-Jitsu positional hierarchy as a directed graph, with:

- **Nodes (States)**: Represented as rounded rectangles, color-coded by position type
- **Edges (Transitions)**: Represented as arrows connecting states, labeled with technique names
- **Weights**: Indicated by line thickness representing success probability

## Canvas Structure

The canvas is organized in a hierarchical layout with the following sections:

### 1. Standing Position (Top)
- Starting point of all exchanges
- Branches to takedowns and guard pulls

### 2. Guard Positions (Left Section)
- Closed Guard
- Half Guard variations
- Open Guard family
- Leg entanglement system

### 3. Dominant Positions (Right Section)
- Side Control
- Mount
- Back Control
- Submission control positions

### 4. Terminal State (Bottom)
- Won by Submission (victory condition)

## Color Coding

States are color-coded for quick visual identification:

- **Green**: Neutral positions (Standing, Closed Guard)
- **Blue**: Bottom positions (Open Guard, Half Guard, etc.)
- **Orange**: Top positions (Side Control, Mount)
- **Red**: Dominant control positions (Back Control, Inside Sankaku)
- **Purple**: Submission control positions (Triangle Control, Armbar Control)
- **Black**: Terminal state (Won by Submission)

## Key Node Connections

### Standing Position (S001)
- → Closed Guard Bottom (via Pull Guard)
- → Side Control (via Double Leg Takedown)
- → Top Half Guard (via Single Leg Takedown)
- → Back Control Standing (via Collar Drag)

### Closed Guard Bottom (S002)
- → Triangle Control (via Triangle Setup)
- → Mount (via Hip Bump Sweep)
- → Open Guard Bottom (via Open Guard Transition)

### Half Guard Bottom (S006)
- → Deep Half Guard (via Deep Half Entry)
- → Closed Guard Bottom (via Half Guard to Closed Guard)
- → Side Control Top (via Old School Sweep)

### Open Guard Bottom (S007)
- → Triangle Control (via Triangle Setup from Open Guard)
- → Single Leg X Guard (via Single Leg X Entry)
- → Top Position (via Butterfly Sweep)

### Single Leg X Guard (S008)
- → Top Position (via SLX Technical Standup Sweep)
- → Ashi Garami (via SLX to Ashi Garami)
- → X-Guard (via SLX to X-Guard)

### Ashi Garami (S009)
- → Inside Sankaku (via Transition to Inside Sankaku)
- → Won by Submission (via Straight Ankle Lock)
- → Top Position (via Technical Stand-up)

### Inside Sankaku (S010)
- → Won by Submission (via Inside Heel Hook)
- → Back Control (via Back Take from Inside Sankaku)
- → Top Position (via Technical Stand-up)

### Side Control (S003)
- → Mount (via Transition to Mount)
- → Back Control (via Gift Wrap Control)
- → Won by Submission (via Paper Cutter Choke)

### Mount (S004)
- → Back Control (via Technical Mount Transition → Back Take)
- → Won by Submission (via Cross Collar Choke)
- → Triangle Control (via Triangle from Mount)

### Back Control (S005)
- → Won by Submission (via Rear Naked Choke)
- → Won by Submission (via Bow and Arrow Choke)
- → Triangle Control (via Back Triangle)

### Triangle Control (S101)
- → Won by Submission (via Triangle Finish)
- → Armbar Control (via Transition to Armbar)
- → Mount (via Triangle to Mount)

## Optimal Paths Highlighted

The canvas highlights four optimal paths to submission with thicker, colored arrows:

### Path 1: Positional Dominance (Blue)
Standing → Double Leg Takedown → Side Control → Mount → Arm Triangle → Won by Submission

### Path 2: Bottom Game (Green)
Standing → Pull Guard → Closed Guard Bottom → Triangle Control → Triangle Finish → Won by Submission

### Path 3: Back Attack System (Red)
Standing → Collar Drag → Back Control Standing → Back Control → Rear Naked Choke → Won by Submission

### Path 4: Leg Lock System (Purple)
Standing → Pull Guard → Open Guard Bottom → Single Leg X Guard → Inside Sankaku → Inside Heel Hook → Won by Submission

## Implementing the Canvas in Obsidian

To create this canvas in Obsidian:

1. Create a new canvas (click the canvas icon in the left sidebar)
2. Add nodes for each state listed above
3. Connect nodes with arrows representing transitions
4. Color-code nodes according to the scheme above
5. Adjust node size based on positional importance
6. Highlight optimal paths with thicker, colored arrows
7. Add labels to both nodes and edges
8. Save the canvas as "BJJ State Machine Canvas"

## Using the Canvas for Learning

The canvas offers several learning applications:

1. **Path Analysis**: Identify multiple paths from your current position to submission
2. **Gap Identification**: Find areas of your game with limited connections
3. **Sequence Planning**: Create training sequences by following specific paths
4. **Technique Contextualization**: Understand where individual techniques fit in the larger system
5. **Decision Point Recognition**: Identify key branching positions that offer multiple strategic options

## Alternative Views

The canvas can be reorganized to highlight different aspects of the BJJ system:

- **Point-Based View**: Arrange by positional hierarchy (0-4 points)
- **Expert-Based View**: Group by prominent practitioner systems (Danaher, Ryan, Bravo)
- **Tournament-Legal View**: Filter by competition legality (IBJJF rules)
- **Energy Efficiency View**: Organize by physical exertion required

## Canvas Updates

As you add more states and transitions to your knowledge base, update the canvas to include these new elements, maintaining the visual coherence of the system while expanding its complexity and comprehensiveness.

---

## 🚀 Premium Services

Ready to take your BJJ to the next level? Check out our premium services:

- **[Publish Your BJJ Content →](https://contribute.bjjgraph.org/guest-posts)** - Get your articles featured on BJJGraph ($49-$99)
- **[Get Your Game Analyzed →](https://contribute.bjjgraph.org/game-analysis)** - Personalized BJJ game plan tailored to YOUR style ($49)

[**Explore All Services →**](https://contribute.bjjgraph.org)
