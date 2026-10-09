import { Coins } from 'lucide-react'
import { describeApiError } from '../../api/errors.ts'
import { formatInteger } from '../../lib/format.ts'
import type { User } from '../auth/dto.ts'
import { useGlobalWallet, useLocalWallets } from './api.ts'
import styles from './AccountPage.module.css'

/** Global coins and each joined package's own currency, as the server reports them. */
export function Wallets({ user, nameOf }: { user: User; nameOf: (packageId: string) => string }) {
  const global = useGlobalWallet(user.user_id)
  const locals = useLocalWallets(user.user_id, user.package_ids)
  return (
    <section aria-labelledby="wallets-heading" className={styles.section}>
      <h2 id="wallets-heading">Wallets</h2>
      <ul className={styles.wallets}>
        <li className={styles.wallet} data-kind="global">
          <span className={styles.walletLabel}>
            <Coins size={18} aria-hidden="true" /> Coins
          </span>
          <WalletAmount amount={global.data?.amount} pending={global.isPending} error={global.error} />
          <span className={styles.walletNote}>Shared across packages</span>
        </li>
        {user.package_ids.map((packageId, index) => {
          const wallet = locals[index]
          return (
            <li key={packageId} className={styles.wallet}>
              <span className={styles.walletLabel}>{nameOf(packageId)}</span>
              <WalletAmount amount={wallet?.data?.amount} pending={wallet?.isPending ?? true} error={wallet?.error ?? null} />
              <span className={styles.walletNote}>Package currency</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function WalletAmount({ amount, pending, error }: { amount: number | undefined; pending: boolean; error: Error | null }) {
  if (error) return <span className={styles.walletError}>Unavailable: {describeApiError(error)}</span>
  if (pending || amount === undefined) return <span className={styles.walletAmount} aria-busy="true">…</span>
  return <span className={`${styles.walletAmount} tabular`}>{formatInteger(amount)}</span>
}
