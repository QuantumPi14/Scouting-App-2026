import { Link } from 'react-router-dom'
import { useUpdateSW } from '../useUpdateSW'
import styles from './Layout.module.css'

export function Layout({ children }: { children: React.ReactNode }) {
  const { needRefresh, updateServiceWorker } = useUpdateSW()

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <Link to="/" className={styles.homeLink}>Home</Link>
        <div className={styles.actions}>
          {needRefresh && (
            <button type="button" className={styles.updateBtn} onClick={updateServiceWorker}>
              Update app
            </button>
          )}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
