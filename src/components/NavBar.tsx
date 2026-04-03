import { NavLink } from 'react-router-dom'
import styles from './NavBar.module.css'

export function NavBar() {
  return (
    <nav className={styles.nav}>
      <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>
        Home
      </NavLink>
      <NavLink to="/session" className={({ isActive }) => isActive ? styles.active : ''}>
        Session
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => isActive ? styles.active : ''}>
        Progress
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? styles.active : ''}>
        Settings
      </NavLink>
    </nav>
  )
}
