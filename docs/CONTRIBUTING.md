# Contributing to BJJ Graph

This guide provides information for contributors, developers, and content creators working on the BJJ Graph project.

---

## Project Overview

BJJ Graph models Brazilian Jiu-Jitsu as a complete state machine, mapping the intricate relationship between positions (states) and techniques (transitions). By leveraging computer science principles, the system creates a comprehensive and structured approach to learning BJJ, with an emphasis on finding optimal paths to victory.

### State Machine Model

BJJ is uniquely suited to state machine modeling: practitioners move between distinct positions through specific techniques, with each position offering different strategic advantages. This project creates a formal graph structure where:

- **Nodes** = Positions (States)
- **Edges** = Techniques (Transitions)
- **Terminal Node** = Submission Victory
- **Weights** = Success probability, risk, energy cost

### Computer Science Principles Applied

This project leverages several CS concepts:
- **Finite State Machines**: Modeling positions and transitions
- **Graph Theory**: Finding optimal paths through the position network
- **Decision Trees**: Conditional logic for position-specific decisions
- **Probabilistic Analysis**: Success rates and risk assessment
- **Pathfinding Algorithms**: Determining efficient routes to submission
- **Pattern Recognition**: Identifying common principles across positions

---

## How to Use This Knowledge Base

### For Beginners
1. **Start with Core States**: Begin with the fundamental positions (Standing, Closed Guard, Side Control, Mount, Back Control)
2. **Follow Simple Paths**: Review the "Optimal Submission Paths" section in each position file
3. **Focus on High-Percentage Techniques**: Look for transitions with 70%+ success rates
4. **Use the Decision Trees**: Apply the conditional logic provided in each position
5. **Follow the Learning Progression**: Use the structured learning path in Learning Progression files

### For Intermediate Practitioners
1. **Explore Alternative Paths**: Study less direct but higher-percentage paths to submission
2. **Connect Systems**: Use the Canvas visualization to identify connections between positions
3. **Study Expert Insights**: Review the methodology from Danaher, Ryan, and Bravo for each position
4. **Analyze Position Metrics**: Use success/failure probabilities to identify strengths and weaknesses
5. **Practice System-Based Training**: Implement connected sequences rather than isolated techniques

### For Advanced Practitioners
1. **Optimize Your Game**: Identify your highest-percentage techniques and link them into systems
2. **Develop Counter-Strategies**: Study defensive responses and counter transitions
3. **Create New Paths**: Identify and document novel connections between states
4. **Competition Preparation**: Use Competition Strategy files to develop match-specific approaches
5. **Create Personalized Systems**: Adapt the knowledge base to your physical attributes and preferences

---

## File Structure and Content Standards

### Content Directory Structure
```
source/content/
├── Positions/           # State definitions (95+ files)
│   ├── CONTRIBUTING-POSITIONS.md  # Position contributor guide
│   ├── Mount.md         # Example: S004 - Mount position
│   └── ...
├── Transitions/         # State transitions (71+ files)
│   ├── CONTRIBUTING-TRANSITIONS.md  # Transition contributor guide
│   ├── Bridge and Roll.md
│   └── ...
├── Submissions/         # End-state techniques (49+ files)
│   ├── CONTRIBUTING-SUBMISSIONS.md  # Submission contributor guide
│   ├── Triangle Finish.md
│   └── ...
├── Concepts/            # Fundamental principles (30+ files)
│   ├── CONTRIBUTING-CONCEPTS.md  # Concepts contributor guide
│   └── ...
├── Systems/             # Integrated systems and strategies (21+ files)
│   ├── CONTRIBUTING-SYSTEMS.md  # Systems contributor guide
│   └── ...
└── Pedagogy/            # Learning methodology
```

### Contributor Guide Files

Each content folder contains a `CONTRIBUTING-[TYPE].md` file that defines the required structure for creating content of that type. These files are excluded from the website (see quartz.config.ts) and serve as references for content creators and the automated improvement bot.

#### Position Files (States)
Files represent positions following the `CONTRIBUTING-POSITIONS.md` guide:
- **File Name**: `Position Name.md` (e.g., `Mount.md`)
- **State ID**: S-prefix numerical identifier (e.g., S004)
- **Required Properties**: Point value, position type, risk level, energy cost, success probabilities
- **State Machine Elements**: Visual description, defensive responses, offensive transitions, decision trees
- **Educational Content**: Expert insights (Danaher, Ryan, Bravo), common errors, key principles
- **Integration Elements**: State invariants, timing considerations, training scenarios
- **Validation Checklist**: 15 mandatory elements that must be included

#### Transition Files (Techniques)
Files represent techniques following the `CONTRIBUTING-TRANSITIONS.md` guide:
- **File Name**: `Technique Name.md` (e.g., `Bridge and Roll.md`)
- **Transition ID**: T-prefix numerical identifier (e.g., T904)
- **Required Properties**: Starting/ending states, success probabilities, complexity, energy cost, risk level
- **Physical Requirements**: Strength, flexibility, coordination, speed requirements
- **Execution Elements**: Visual sequence, numbered steps, technical details, success modifiers
- **Counter-Attack Analysis**: Common counters, decision logic, resistance patterns
- **Educational Content**: Expert insights, common errors, timing considerations, prerequisites
- **Assessment Elements**: Knowledge questions, variants, training progressions
- **Technical Specifications**: Animation keyframes, biomechanical analysis

#### Submission Files (End States)
Files represent submissions following the `CONTRIBUTING-SUBMISSIONS.md` guide:
- **File Name**: `Submission Name.md` (e.g., `Triangle Finish.md`)
- **Submission ID**: SUB-prefix numerical identifier (e.g., SUB001)
- **Required Properties**: Starting state, submission type, success probabilities, setup complexity
- **State Machine Elements**: Visual finishing sequence, setup requirements, execution steps
- **Defense Patterns**: Common escapes, defensive decision logic, resistance patterns
- **Educational Content**: Expert insights, safety considerations, common errors, mechanical principles
- **Assessment Elements**: Knowledge questions, variations, training progressions
- **Safety Emphasis**: Critical safety information, responsible training practices

---

## Content Creation Guidelines

### For New Position Files:
1. **Follow the contributor guide** at `source/content/Positions/CONTRIBUTING-POSITIONS.md`
2. **Assign unique State ID** (format: S### where ### is next available number)
3. **Complete all required sections** per the validation checklist
4. **Include probability data** for all skill levels (Beginner/Intermediate/Advanced)
5. **Provide expert insights** from all three authorities (Danaher, Ryan, Bravo)
6. **Define clear state invariants** (conditions that must remain true)
7. **Map all transitions** with linking to existing position/transition files
8. **Include detailed visual description** for spatial understanding

### For New Transition Files:
1. **Follow the contributor guide** at `source/content/Transitions/CONTRIBUTING-TRANSITIONS.md`
2. **Assign unique Transition ID** (format: T### where ### is next available number)
3. **Link to existing positions** for starting and ending states
4. **Provide execution steps** (minimum 6 numbered steps)
5. **Include success modifiers** with specific percentage impacts
6. **Map counter-techniques** with success rates and conditions
7. **Define physical requirements** for strength, flexibility, coordination, speed
8. **Provide knowledge assessment questions** (minimum 5 questions)

### For New Submission Files:
1. **Follow the contributor guide** at `source/content/Submissions/CONTRIBUTING-SUBMISSIONS.md`
2. **Assign unique Submission ID** (format: SUB### where ### is next available number)
3. **Link to control position** required for setup
4. **Include comprehensive safety information** and injury risk assessment
5. **Provide defensive escape options** with success rates and time windows
6. **Define anatomical targeting** with primary/secondary effects
7. **Emphasize safety considerations** throughout all content
8. **Include training progressions** from technical understanding to live application

---

## File Naming Conventions

- **Use descriptive names** that match the technique/position name exactly
- **Avoid abbreviations** unless they are standard (e.g., "RNC" for Rear Naked Choke)
- **Use title case** for file names (e.g., "Half Guard Bottom.md")
- **Include linking** between related files using `[[File Name]]` syntax
- **Maintain consistency** with existing naming patterns in each folder

---

## Content Quality Standards

- **Probability data must be realistic** and based on competition analysis where possible
- **Expert insights must be authentic** to each authority's documented methodology
- **Safety information is mandatory** for all submission content
- **Visual descriptions must be detailed** enough for clear spatial understanding
- **All transition links must be valid** and lead to existing files
- **Success rates must include modifiers** showing factors that increase/decrease probability
- **Training progressions must be logical** from basic to advanced application

---

## Integration Requirements

- **State IDs must be unique** across all position files
- **Transition IDs must be unique** across all transition files
- **Submission IDs must be unique** across all submission files
- **All file links must resolve** to existing files in the system
- **Probability data must be consistent** between linked files
- **Expert insights must not contradict** between related techniques
- **Safety standards must be maintained** throughout all submission content

---

## Tagging System

### Position Tags (States)
- #state - All position files
- #standing - Standing positions
- #guard - Guard positions (closed, half, butterfly, etc.)
- #mount - Mount positions
- #side_control - Side control position
- #back_control - Back control position
- #halfguard - Half guard position
- #turtle - Turtle position
- #open_guard - Open guard variations
- #leg_entanglement - Leg lock positions

### Transition Tags
- #transition - All transition files
- #takedown - Taking opponent down from standing
- #guardpass - Moving from guard to a dominant position
- #sweep - Reversing position from bottom to top
- #submission - Finishing techniques
- #escape - Getting out of inferior positions
- #reversal - Changing position advantage
- #retention - Maintaining guard against passing attempts
- #recovery - Regaining a better position
- #leglock - Leg-based submissions

### Conceptual Tags
- #principle - Fundamental concepts
- #strategy - Overall approach considerations
- #defense - Defensive techniques
- #offense - Offensive techniques
- #setup - Preparation for another technique
- #counter - Response to opponent's technique
- #drill - Specific training exercises
- #competition - Competition-specific tactics

### Expert Tags
- #danaher - John Danaher's methodology
- #ryan - Gordon Ryan's approach
- #bravo - Eddie Bravo's 10th Planet system

---

## Point System and State Hierarchy

This project uses a point system reflecting positional advantage:
- Standing (Neutral): 0 points
- Guard Bottom: 0 points
- Guard Top: 1 point
- Half Guard Top: 2 points
- Side Control: 3 points
- Mount: 4 points
- Back Control: 4 points
- Submission: Victory

---

## Development Guidelines

### Project Setup Instructions

To contribute to or work with this project locally:

1. **Clone the Repository**: Clone the BJJGraph repository from GitHub to your local machine.

2. **Install Dependencies**:
   - **Node.js**: Required for running Quartz (version specified in `source/.node-version`)
   - Run `npm install` or `pnpm install` from the `source/` directory
   - **Python**: Optional, for content validation scripts

3. **Run Locally**: From the `source/` directory, run `npm run dev` or `pnpm run dev` to preview the content

4. **Environment Configuration**: Check `source/quartz.config.ts` for any custom configurations

### Contribution Guidelines

We welcome contributions to enhance the BJJ knowledge base and associated tools:

1. **Content Contributions**:
   - Follow the contributor guides in `CONTRIBUTING-[TYPE].md` files
   - Ensure all required sections are completed as per the validation checklists
   - Use title case for file names and link related files using `[[File Name]]` syntax
   - Note: CONTRIBUTING-*.md files are excluded from the website

2. **Code Contributions**:
   - Use consistent coding standards (Prettier rules in `source/.prettierrc`)
   - Write clear commit messages describing the purpose of changes
   - Submit pull requests with detailed descriptions

3. **Areas for Contribution**:
   - Expanding the content library with new positions, transitions, or submissions
   - Developing scripts for content validation or automation
   - Improving documentation or visualizations

### Testing and Validation

To maintain data integrity and quality:

- **Content Validation**: Run `python3 scripts/validate_content.py` to check for missing fields or inconsistent data
- **Manual Review**: Verify that all links resolve to existing files and that probability data aligns across related files
- **Schema Validation**: Use Google Rich Results Test to validate schema markup

### Automation

The project includes automated workflows:
- **Content Improvement Bot**: Runs hourly to improve 5 random files per run
- **Content Growth Bot**: Creates new content from priority list
- See `.github/workflows/` for configuration

---

## Contact and Collaboration

For questions, collaboration, or to report issues:
- **GitHub Issues**: Use the project's GitHub repository to file issues or suggest enhancements
- **Documentation**: See `/docs/` for reference guides and implementation status

---

## Benefits of This System

1. **Structured Learning Path**: Instead of learning isolated techniques, practitioners follow connected paths through the positional hierarchy
2. **Strategic Framework**: Positions and transitions are contextualized within game plans
3. **Adaptable to Individual Styles**: Multiple pathways accommodate different body types and preferences
4. **Efficiency Through Graph Theory**: Focus training on highest-probability paths to victory
5. **Connection-Based Understanding**: Techniques are always presented in their tactical context

---

**For more information:**
- **Documentation**: `/docs/README.md`
- **Active Tasks**: `/todo/other_todos_left_for_devs.md`
- **Standards**: See CONTRIBUTING-*.md files in each content directory
- **Project Philosophy**: See CLAUDE.md for AI assistant guidance

**Last Updated**: October 12, 2025
