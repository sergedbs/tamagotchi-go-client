# Tamagotchi Go - Frontend Visual Design Guidelines

> **Audience:** AI coding/design agents (Claude Code, Codex, and similar tools) implementing the Tamagotchi Go client.
>
> **Purpose:** Establish a distinctive, cohesive, polished visual identity and consistently high design quality. These instructions concern **visual design and presentation**, not frontend architecture, backend integration, or feature specifications.

## 0. How to use these instructions

Read this document alongside the client requirements, backend specifications, and other project instructions **before proposing or implementing the UI**.

- Treat the supplied product requirements and functional specifications as the source of truth for **what the client must do**. Do not invent screens, features, gameplay systems, or capabilities to make the design more impressive.
- Treat this document as the source of guidance for **how the experience should look and feel**.
- If a prescribed visual treatment conflicts with usability, accessibility, an explicit product requirement, or an established approved design system, adapt the treatment rather than forcing it.
- Do not assume a particular platform, framework, screen count, orientation, art asset library, or device form factor unless the supplied specifications establish it.
- Preserve existing approved design decisions and functionality when refining an implemented screen. If no visual direction has been approved, propose one before broad implementation.

## 1. Design objective

Approach the interface as a **senior product designer and game UI art director**, not merely as a frontend developer assembling components.

Tamagotchi Go should feel like a genuinely designed product: visually distinctive, consistent, engaging, and credible as a polished indie or commercial game. It must not resemble a generic AI-generated website or a business dashboard with gaming-themed icons.

The intended character is **playful, adventurous, approachable, and refined**. Playful does not mean childish; polished does not mean sterile; visually rich does not mean cluttered.

Every important design choice should serve the game's identity, content, hierarchy, or interaction. Prefer a few excellent, memorable decisions over indiscriminate decoration.

## 2. Establish an art direction before building screens

Before broad implementation:

1. Understand the project's supported gameplay, users, primary flows, and target platforms from its specifications.
2. Propose **three genuinely distinct visual directions** (not three shades of the same interface). For each, outline the mood, palette, typography, shapes, iconography/illustration style, surfaces, navigation feel, animation style, and application to core gameplay screens.
3. Identify the strengths, risks, and trade-offs of each direction. Recommend one based on the actual requirements.
4. **Obtain direction approval when working interactively.** If working autonomously and approval is not possible, select one coherent direction, document the reasoning, and proceed consistently rather than creating a hybrid of unrelated styles.
5. Define a compact, reusable visual system before expanding to the complete interface.

Potential *inspirations* include creature-collection games, virtual-pet experiences, location-based adventures, illustrated exploration UIs, and thoughtfully designed handheld game interfaces. Examples such as Pokémon GO and Pikmin Bloom may be studied for composition and gameplay HUD patterns, **not copied**. Tamagotchi Go must establish its own identity.

Do not commit to a palette, font, or art style just because it is common in game UIs. Choose based on the experience being designed.

## 3. Avoid generic AI-generated aesthetics

Actively inspect designs for habitual, interchangeable patterns, including:

- Corporate/SaaS dashboards, analytics panels, or admin templates repurposed as a game.
- Generic hero sections and predictable landing-page layouts inside the game experience.
- Repetitive grids of nearly identical cards and excessive cards nested within cards.
- The same radius, padding, shadow, and treatment applied uniformly to every element.
- Unmotivated purple/blue gradients, neon highlights, glassmorphism, glow, blur, or gradient borders.
- Dark backgrounds with arbitrary bright accent colors, or trendy cream/serif treatments used without a product-specific reason.
- Unnecessary eyebrow labels, uppercase captions, pills, badges, decorative numbers, arrows, and dividers.
- Centered-everything layouts, excessive empty space, or decorative clutter without compositional purpose.
- Generic fonts, mismatched icons, stock imagery, and emoji used in place of an icon system.
- Repetitive entrance fades, exaggerated hover effects, or movement that does not communicate anything.

These are **not universal bans**. Use a card, gradient, rounded corner, shadow, or animation when it solves a real design need and is consistent with the chosen art direction. The objective is to avoid defaults without replacing them with a new set of clichés.

## 4. Visual system and art direction

### 4.1 Color

- Establish a restrained palette with clear roles: primary, secondary, accent, background, surface, text, and semantic/gameplay states.
- Use one recognizable visual identity across screens. Reserve stronger colors for actions, key information, special events, and gameplay emphasis.
- Use gradients, highlights, and shadows sparingly and intentionally.
- Check contrast and state differentiation; do not rely on color alone to communicate essential status.
- Avoid unrelated accent colors accumulating as new screens are added.

### 4.2 Typography

- Choose typefaces with personality appropriate to the game while keeping UI text effortlessly readable.
- Define a meaningful hierarchy for titles, stats, labels, body text, and compact HUD information.
- Use deliberate font sizes, weights, line heights, letter spacing, and text widths.
- Avoid default-font appearance and excessive font families, weights, or ALL CAPS.
- Confirm readability on the actual target screen sizes, especially for small map/HUD labels.

### 4.3 Layout and composition

- Organize each screen around its **primary player task** and strongest visual focus.
- Use clear alignment, proportional spacing, optical balance, and sensible information density.
- Let creatures, maps, and other gameplay content dominate when relevant; the UI should support them rather than compete with them.
- Avoid unnecessary panels and container boundaries. Not every piece of information needs a card.
- Vary composition where content importance changes; do not force every screen into one repeated grid.
- Use whitespace to create clarity, not simply to look minimalist.

### 4.4 Shapes, depth, and components

- Define consistent radii, stroke weights, corner treatments, shadows, and elevation rules.
- Make components tactile or expressive only when that fits the art direction.
- Distinguish component roles visually (primary action, secondary action, information, status, navigation).
- Reuse a compact visual vocabulary without making every element identical.
- Avoid decorative frames, borders, or shadows that do not improve hierarchy or recognition.

### 4.5 Icons, illustrations, and assets

- Use a coherent icon family with consistent style, stroke, fill, size, and optical alignment.
- Give original creature art and meaningful gameplay illustrations visual priority.
- Avoid unrelated illustration styles, mismatched assets, placeholder emoji, or generic stock art.
- When assets are unavailable, design graceful placeholders that clearly indicate their role without pretending finished assets exist.
- Do not use CSS effects to compensate for missing art direction.

### 4.6 Motion and feedback

- Use motion to clarify state changes, reinforce actions, and give the experience a sense of life.
- Prioritize responsive interactions and occasional satisfying feedback over constant animation.
- Reserve more expressive transitions for meaningful moments (for example, a raid outcome or creature interaction), if such moments are supported by the specifications.
- Maintain consistent durations, easing, and motion patterns; respect reduced-motion preferences.
- Avoid indiscriminate entrance animations or effects that distract from gameplay.

## 5. Tamagotchi Go-specific design principles

### 5.1 Overall game feel

The client should feel like an **exploration and creature-focused game**, not a conventional website. The UI should create a sense of discovery and make interactions with virtual creatures feel personal. Give it character through composition, illustration, typography, and interaction-not through adding visual noise.

### 5.2 Map and exploration screens (where specified)

- Treat the map as the principal canvas when geographic exploration is the main task.
- Favor lightweight, legible overlays and a compact HUD over large permanent sidebars or cards covering the map.
- Develop a consistent visual language for markers, player position, nearby activities, selected locations, and important states, insofar as the specifications require them.
- Prioritize map readability and obvious tap/click targets; contextual information should appear when useful rather than compete continuously with the map.
- Preserve a clear hierarchy between location content and navigation/actions.

### 5.3 Creatures and virtual-pet screens (where specified)

- Make the creature the focal point; give artwork appropriate space and framing.
- Communicate creature state, needs, progress, and available actions clearly, based on the actual feature set.
- Use expressive details and subtle feedback to support attachment and personality.
- Avoid turning creature-related screens into a table of stats or an array of equal-weight cards.
- Ensure status indicators are understandable at a glance and accessible beyond color alone.

### 5.4 Monster raids (where specified)

- Allow raids to be more energetic and dramatic while retaining the same underlying visual identity.
- Establish strong hierarchy for objectives, relevant status/progress, participant or monster information, and player actions, as applicable.
- Make actionable, waiting, success, and failure states visibly distinct without unnecessary clutter.
- Use satisfying but restrained visual feedback for significant gameplay events.
- Do not invent mechanics, statistics, countdowns, reward types, or outcomes absent from the product specification.

### 5.5 Navigation and supporting screens

- Design navigation around the player's core flows, not a default web-app sidebar or tab pattern chosen automatically.
- Keep account, inventory, settings, and other supporting interfaces coherent with the game's visual world wherever those screens are specified.
- Allow quieter screens to be simpler without becoming visually unrelated.
- Use game-appropriate affordances while preserving clear labels and discoverability.

## 6. Design for actual use

Professional visual quality includes the states and constraints that templated mockups often omit:

- Design for the **specified platforms and viewport sizes**; adapt hierarchy and composition rather than simply shrinking a desktop layout.
- Account for real-length names, varied data, dense content, and localization where relevant.
- Provide visually consistent loading, empty, unavailable, disabled, error, and selected states for implemented features.
- Maintain sufficient contrast, visible focus, legible type, appropriately sized controls, and understandable status cues.
- Ensure decorative artwork does not obscure essential gameplay information or interaction targets.
- Favor cohesive simplicity over spectacle when these goals conflict.

## 7. Design-first implementation and review workflow

Follow this sequence for new work:

**A. Understand:** Read the client and backend specifications. Identify the actual supported screens, game entities, player goals, and constraints. Do not add features to fill visual space.

**B. Direct:** Establish or reuse an approved art direction. If none exists, explore three distinct visual concepts and choose/confirm one as described above.

**C. Systematize:** Define a small design system: color roles, typography, spacing, radii, strokes, surfaces, shadows, icons, motion, and HUD/navigation conventions. Keep it coherent and lightweight.

**D. Prove:** Implement or mock up **one representative core screen** first (preferably the main gameplay/exploration screen if applicable). Use it to validate the actual visual language before producing many screens.

**E. Review the rendered result:** Inspect actual screen captures at relevant sizes rather than assessing JSX/CSS/source alone. Evaluate composition, balance, text hierarchy, legibility, colors, assets, component proportions, and generic-AI visual patterns.

**F. Refine:** Identify the **five most significant visual weaknesses**. Correct underlying layout, typography, hierarchy, or cohesion issues before adding effects. Revisit the rendered result and repeat as necessary.

**G. Expand:** Apply the approved system across remaining required screens, varying composition appropriately while preserving identity.

Do not declare visual design finished solely because the interface renders or functionality works.

## 8. Visual review checklist

Before considering a screen complete, answer the following:

1. **Product specificity:** Would the interface still make sense if the game logo and text were replaced with a generic SaaS brand? If so, what makes it insufficiently game-specific?
2. **Visual identity:** Is there a recognizable, cohesive art direction shared with the rest of Tamagotchi Go?
3. **Hierarchy:** Is the most important gameplay content immediately apparent? Are supporting controls subordinate?
4. **Typography:** Is the type distinctive yet readable, with an intentional hierarchy?
5. **Composition:** Are spacing, alignment, proportions, density, and negative space deliberate?
6. **Color and depth:** Do colors, surfaces, borders, and shadows carry meaning rather than decorate indiscriminately?
7. **Assets:** Are icons and illustrations coherent and appropriate, without low-effort placeholders masquerading as final art?
8. **Interaction:** Do controls and state changes feel responsive, legible, and consistent?
9. **Resilience:** Does the interface still look good with realistic content, different screen sizes, and loading/empty/error states?
10. **Restraint:** What could be removed to improve clarity? Are there unnecessary effects, pills, cards, captions, or animations?

A screen passes when it feels **purpose-built, game-like, coherent, and carefully refined**-not when it merely looks trendy.

## 9. Instructions for autonomous design agents

When receiving this document together with the project specifications:

- Follow the **actual application requirements** for scope and behavior; use this document for aesthetic decisions.
- Begin by stating the chosen art direction briefly, along with why it suits the game and the target platform.
- Make visual decisions explicit in the design system and apply them consistently.
- Prefer original, game-appropriate compositions over off-the-shelf templates.
- If design references or assets are provided, integrate them without making the result a direct copy of another product.
- Critique the rendered interface and improve it; avoid stopping after the first workable version.
- Do not introduce technical frameworks, dependencies, architecture changes, or gameplay features solely for visual reasons unless independently authorized.

### Core standard

**Create a distinct Tamagotchi Go visual identity and execute it with precision.** A restrained but beautifully composed screen is better than a visually noisy one. The goal is for the frontend to feel intentionally designed for this game, not automatically generated from a generic UI template.
