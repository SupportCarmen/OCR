import { useEffect } from 'react'

export function useDarkMode() {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    localStorage.removeItem('theme')
  }, [])

  return [false, () => {}]
}
