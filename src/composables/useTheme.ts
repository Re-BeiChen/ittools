import { ref, watchEffect } from 'vue'

const THEME_KEY = 'ittools:theme'

const isDark = ref(
  (() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })(),
)

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
})

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }
  return { isDark, toggle }
}
