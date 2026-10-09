import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  busy?: boolean
  confirmDisabled?: boolean
  /** Inline, persistent feedback for a failed attempt. */
  feedback?: ReactNode
  onConfirm: () => void
  onClose: () => void
}

/** Native modal dialog: focus is trapped and Escape closes it. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (props.open && !dialog.open) dialog.showModal()
    if (!props.open && dialog.open) dialog.close()
  }, [props.open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onClose={props.onClose}
      onCancel={(event) => {
        if (props.busy) event.preventDefault()
      }}
    >
      <div className={styles.body}>
        <h2 id="confirm-title">{props.title}</h2>
        {props.children && <div className={styles.text}>{props.children}</div>}
        {props.feedback}
        <div className={styles.actions}>
          <Button variant="quiet" onClick={props.onClose} disabled={props.busy}>
            Cancel
          </Button>
          <Button
            variant={props.tone === 'danger' ? 'danger' : 'primary'}
            onClick={props.onConfirm}
            busy={props.busy}
            disabled={props.confirmDisabled}
          >
            {props.confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
