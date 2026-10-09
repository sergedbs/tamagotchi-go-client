# Creature assets

## Selected pack

The repository includes 97 licensed PNGs from Jackalune's Lythbound Creatures
Asset Pack in `public/assets/creatures/lythbound/`. Families: Flyte, Gryfon,
Igalyph, Laguna, Nimblithe and Wolfren. Each image is 200x200 with an alpha channel.
Images are static illustrations, not animation frames or evolution stages.

Use [catalog.json](../public/assets/creatures/lythbound/catalog.json) for stable
`sprite_ref`, public URL, species, variant, dimensions and image SHA-256 values.
It also records the source archive checksum and license provenance. Original PNG
bytes are preserved; only path casing changed. No ZIP or duplicate source images
are committed. Read [credits](../public/assets/creatures/lythbound/CREDITS.md) and
retain [the license](../public/assets/creatures/lythbound/LICENSE.txt).

## First visual proof

Start with `lythbound/wolfren/green` and `lythbound/laguna/blue` for two companion
presentations; use `lythbound/gryfon/spicy` for an initial boss illustration.
These are presentation choices, not server combat-type rules. Final names,
package definitions and boss IDs are supplied by authored fixtures.

Use the pack's readable outlines and coherent shading with the existing modern
handheld visual system. Render cards at 64-128 CSS pixels and the hero near its
native 200-pixel size. Avoid large full-screen enlargement; these are modest
resolution assets. Use ordinary image smoothing, not pixel-art rendering.
Preserve aspect ratio, transparency and comfortable space around silhouettes.
Do not recolor each image through arbitrary CSS filters.

Subtle idle/interaction motion may animate the image container, with reduced-motion
support. Do not imply genuine frame animation. Distinct color variants do not
automatically mean rarity, level or evolution; server data remains authoritative.

## Integration

Vite serves these files at `/assets/creatures/lythbound/<family>/<variant>.png`.
Use the catalog for preview/client boss mappings. For real package creatures,
publish the selected `sprite_ref` and browser-reachable absolute asset URL through
the Registry package manifest. Do not assume existing package refs match this
pack or overwrite existing package configuration to make a screen work.

Asset selection for new fixtures belongs in one authored package definition.
Persist real package/config/boss mappings returned by the APIs; never infer them
from creature names. Unknown sprites keep the deliberate fallback described in
DESIGN.md. No backend data was changed by this asset import.

Include a Credits view with the exact artist/concept/source/license attribution.
Custom artwork is optional for a demonstrated gap; this licensed pack is the
default and should not be replaced with generated artwork during bootstrap.
