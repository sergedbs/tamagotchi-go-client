# Approved visual direction

## Modern handheld companion

Sergiu delegated the direction choice. Use a tactile, illustrated companion game:
creatures are personal, map exploration is clear and combat feels energetic.
The interface combines a compact device-like navigation rail, confident organic
creature silhouettes and restrained physical depth. It is not a literal handheld
console frame, retro pixel clone, generic dashboard or decorative landing page.

Alternatives considered: an illustrated field journal would depend too much on
decorative art; an expedition atlas would serve mapping well but underplay creature
care. The selected direction supports the whole current product and smaller screens.
Do not create three new directions in the implementation session; improve this
one through rendered review. The supplied VISUAL_GUIDELINES.md remains applicable.

## Design system

| Role | Starting value/rule |
|---|---|
| Background | #F3F5EC, soft pale mineral green |
| Main surface | #FFFFFF; flat for most content, slight depth for controls |
| Ink | #18302C |
| Secondary text | #50645D; verify contrast before use at small sizes |
| Primary action | #256B53 with white text |
| Highlight | #E3A63B, ink text; never small white text on this color |
| Warning/error | #9E352C with an icon/text, not color alone |
| Relationship | friend green, enemy brick, stranger slate; distinct icon/label |
| Titles | Bricolage Grotesque, weights 600/700, compact natural title case |
| Body | Source Sans 3, weights 400/600, local files and licenses |
| Type scale | 12 metadata, 14 compact labels, 16 body, 20 section, 28/36 titles |
| Spacing | 4/8/12/16/24/32/48 px; align optically rather than padding everything equally |
| Corners | 8 controls, 14 contextual sheets, 20 creature stage; not universal pills |
| Lines | 1 px for separation; 2 px for focus/selected state |
| Depth | Short neutral shadow for floating HUD; no glow/glass/blur dependency |
| Motion | 120-180 ms controls; 220-280 ms contextual changes; reduced motion respected |

These values are the starting system, subject to contrast and real-screen QA.
WCAG AA contrast, visible focus and 44 px primary touch targets take priority.
Test color-blind readability, keyboard access, 200% zoom and reduced motion.
Body text must remain legible over the map; use a solid readable surface where
needed rather than arbitrary transparency. Default is one polished light theme.

Use Lucide for navigation/settings/action icons, consistent 20/24 px sizes and
stroke. Use original creature/type artwork for game identity. No emoji stand-ins.
Amounts/countdowns use stable width where updates would cause layout jumping.
Avoid uppercase captions and pills everywhere; labels are actual content.

## Core screen compositions

Creature home: one large expressive creature, its name/type/level and a restrained
stat strip; care actions beneath it, collection subordinate. A softly illustrated
habitat establishes identity, without fake gameplay controls or an inventory grid.
Do not turn every stat into an equal-sized card. States are factual, not made-up moods.

Explore: map takes the available canvas; compact location/refresh HUD, selected
player sheet and navigation remain legible. Mobile contextual sheet can expand
without permanently covering the map; desktop selected details stay narrow. List
fallback must remain usable when WebGL/provider assets fail. Attribution stays
visible at all sizes. No fabricated events scattered over the map for decoration.

Raid: boss focus, clear server HP bar, participant context and one primary attack
control. Leaderboard is a supporting region; outcome and delivery are distinct.
Use stronger scale/color for the real encounter, not gradients or flashing lights.
Battle shares the visual vocabulary but foregrounds the two lineups and turn.

Social/chat: compact rosters and chronological content, readable text and clear
author/state feedback. Secondary spaces are quieter while retaining fonts/colors.
Admin uses deliberate rows/forms and fewer illustrations. Diagnostics remains a
utility drawer/page; it never dominates the player experience.

## Artwork and presentation

No finished artwork was provided. Create original coherent art during the design
proof, beginning with two starter creatures and one boss. Expand only as authored
fixtures need more. Rounded readable silhouettes, limited shading, distinct
materials/personality and consistent lighting are preferable to random stock art.
Produce transparent WebP/PNG or authored SVG as appropriate; use SVG for icons and
simple vector illustrations, not code tricks to imitate a detailed creature.
Image generation may be used for original raster art if available, followed by
visual QA and consistent crop/scale; never copy another game's characters.

Art references are logical sprite_ref IDs mapped through package asset manifests
or the client catalog. Include provenance/licenses. Ship local assets; no hotlinked
example.com images, placeholder emoji or broken CDN artwork in finished fixtures.
A genuine unresolved sprite uses a deliberate outlined silhouette with readable
label, never a fake finished image. Artwork cannot obscure status or action targets.

Use the official font sources and retain their license files:
- [Bricolage Grotesque](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque)
- [Source Sans 3](https://github.com/adobe-fonts/source-sans)

## Prove, critique and expand

Build one representative creature-home screen with real or explicitly previewed
data, plus its mobile composition. Use it to prove typography, artwork scale,
navigation, controls and hierarchy. Then inspect Explore to prove map overlays.
Preview data is isolated to design/test environments, not a production fallback.

Capture actual renders at 390x844 and 1440x900. Identify the five biggest weaknesses
in hierarchy, typography, composition, artwork or usability. Fix underlying causes
before adding effects. Preserve a short critique and before/after evidence outside
Git if screenshots contain private state. Repeat until the composition feels
specific to this product. Functional skeleton is not final visual acceptance.

Check long player/guild names, empty collection, full page of notifications,
unavailable API, partial Map and denied admin action. Lists and buttons must not
collapse or overflow at 360 px. Essential actions remain accessible by keyboard.
Success/error feedback is local to the action; don't use a toast as the only record
of an uncertain mutation. Do not decorate unsupported features into the UI.
