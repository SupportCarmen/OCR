import { useDarkMode } from '../../hooks/useDarkMode'

export default function DarkModeToggle({ size = 'md' }) {
  const [dark, toggle] = useDarkMode()
  return (
    <button
      className={`btn btn-icon dark-toggle btn-${size}`}
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <i className={`fas ${dark ? 'fa-sun' : 'fa-moon'}`} />
    </button>
  )
}
