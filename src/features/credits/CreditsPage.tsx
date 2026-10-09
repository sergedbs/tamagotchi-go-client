import mitLicense from '../../../LICENSE?raw'
import { useSpriteCatalog } from '../../packages/spriteCatalog.ts'
import styles from './CreditsPage.module.css'

const REPOSITORY_URL = 'https://github.com/sergedbs/tamagotchi-go-client'
// The repository LICENSE file is the single source for the text shown here.
const COPYRIGHT = mitLicense.split('\n').find((line) => line.startsWith('Copyright')) ?? ''
const LICENSE_TEXT_URL = '/assets/creatures/lythbound/LICENSE.txt'
const ARTIST_URL = 'https://jackalune.itch.io/'
const CONCEPT_ARTIST_URL = 'https://toripng.carrd.co/'

export default function CreditsPage() {
  const catalog = useSpriteCatalog()
  const pack = catalog.data
  return (
    <main className={styles.credits}>
      <h1>Credits</h1>
      <section aria-labelledby="app-license">
        <h2 id="app-license">Tamagotchi Go client</h2>
        <p>
          The client&apos;s source code is released under the MIT License. {COPYRIGHT}.{' '}
          <a href={REPOSITORY_URL} rel="noreferrer" target="_blank">
            Source code
          </a>
        </p>
        <details className={styles.license}>
          <summary>MIT License text</summary>
          <pre>{mitLicense.trim()}</pre>
        </details>
      </section>
      <section aria-labelledby="art-credits">
        <h2 id="art-credits">Creature artwork</h2>
        {catalog.isError ? (
          <p>
            The artwork catalog could not be loaded. The full license is still available at{' '}
            <a href={LICENSE_TEXT_URL}>LICENSE.txt</a>.
          </p>
        ) : !pack ? (
          <p aria-busy="true">Loading credits…</p>
        ) : (
          <dl className={styles.list}>
            <div>
              <dt>Artwork</dt>
              <dd>
                <a href={ARTIST_URL} rel="noreferrer" target="_blank">
                  {pack.artist}
                </a>
              </dd>
            </div>
            <div>
              <dt>Original concepts</dt>
              <dd>
                Laguna, Igalyph and Nimblithe by{' '}
                <a href={CONCEPT_ARTIST_URL} rel="noreferrer" target="_blank">
                  {pack.concept_credit.split(':')[0]}
                </a>
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <a href={pack.source_url} rel="noreferrer" target="_blank">
                  {pack.pack}
                </a>
              </dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>
                <a href={pack.license_url} rel="noreferrer" target="_blank">
                  Creative Commons Attribution 4.0 International
                </a>{' '}
                ({pack.license}); <a href={LICENSE_TEXT_URL}>full license text</a>
              </dd>
            </div>
            <div>
              <dt>Changes</dt>
              <dd>{pack.modifications}</dd>
            </div>
          </dl>
        )}
        <p className={styles.note}>
          Colour variants are artwork choices only; they do not indicate rarity, level or evolution.
        </p>
      </section>
      <section aria-labelledby="font-credits">
        <h2 id="font-credits">Typefaces</h2>
        <ul className={styles.fonts}>
          <li>
            Bricolage Grotesque by The Bricolage Grotesque Project Authors,{' '}
            <a href="/assets/fonts/BricolageGrotesque-OFL.txt">SIL Open Font License 1.1</a>
          </li>
          <li>
            Source Sans 3 by Adobe, <a href="/assets/fonts/SourceSans3-LICENSE.md">SIL Open Font License 1.1</a>
          </li>
        </ul>
      </section>
      <section aria-labelledby="icon-credits">
        <h2 id="icon-credits">Icons</h2>
        <p>
          Interface icons from{' '}
          <a href="https://lucide.dev/license" rel="noreferrer" target="_blank">
            Lucide
          </a>{' '}
          (ISC License).
        </p>
      </section>
    </main>
  )
}
