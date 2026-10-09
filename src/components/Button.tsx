import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  busy?: boolean
  icon?: ReactNode
  block?: boolean
}

export function Button({ variant = 'secondary', busy = false, icon, block = false, className, children, disabled, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], block ? styles.block : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <button type="button" {...rest} className={classes} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy ? <LoaderCircle className={styles.spin} size={18} aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
