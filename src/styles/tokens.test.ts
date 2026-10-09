import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'
import { contrastRatio } from './contrast.ts'

const tokens = new Map(
  [...tokensCss.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((match) => [match[1], match[2]] as const),
)

function color(name: string): string {
  const value = tokens.get(name)
  if (!value) throw new Error(`Missing colour token --${name}`)
  return value
}

const TEXT = 4.5
const NON_TEXT = 3

const pairs: [string, string, number][] = [
  ['color-ink', 'color-bg', TEXT],
  ['color-ink', 'color-surface', TEXT],
  ['color-ink', 'color-surface-sunken', TEXT],
  ['color-ink', 'color-primary-soft', TEXT],
  ['color-ink', 'color-highlight-soft', TEXT],
  ['color-ink-muted', 'color-bg', TEXT],
  ['color-ink-muted', 'color-surface', TEXT],
  ['color-ink-muted', 'color-surface-sunken', TEXT],
  ['color-on-primary', 'color-primary', TEXT],
  ['color-on-primary', 'color-primary-hover', TEXT],
  ['color-on-primary', 'color-primary-pressed', TEXT],
  ['color-primary', 'color-bg', TEXT],
  ['color-primary', 'color-surface', TEXT],
  ['color-primary', 'color-primary-soft', TEXT],
  ['color-on-highlight', 'color-highlight', TEXT],
  ['color-danger', 'color-surface', TEXT],
  ['color-danger', 'color-bg', TEXT],
  ['color-danger', 'color-danger-soft', TEXT],
  ['color-friend', 'color-surface', TEXT],
  ['color-enemy', 'color-surface', TEXT],
  ['color-stranger', 'color-surface', TEXT],
  ['color-control-border', 'color-surface', NON_TEXT],
  ['color-control-border', 'color-bg', NON_TEXT],
  ['color-focus', 'color-bg', NON_TEXT],
  ['color-focus', 'color-surface', NON_TEXT],
  ...['flame', 'nature', 'earth', 'electric', 'water', 'shadow'].map(
    (type) => [`type-${type}`, `type-${type}-tint`, TEXT] as [string, string, number],
  ),
]

describe('design token contrast (WCAG AA)', () => {
  it('computes the reference ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  })

  it.each(pairs)('%s on %s meets %d:1', (foreground, background, minimum) => {
    expect(contrastRatio(color(foreground), color(background))).toBeGreaterThanOrEqual(minimum)
  })
})
