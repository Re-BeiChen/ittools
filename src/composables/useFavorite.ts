import { ref, watchEffect } from 'vue'

const FAV_KEY = 'ittools:favorites'

const favorites = ref<string[]>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]')
    } catch {
      return []
    }
  })(),
)

watchEffect(() => {
  localStorage.setItem(FAV_KEY, JSON.stringify(favorites.value))
})

export function useFavorite() {
  function toggle(slug: string) {
    const i = favorites.value.indexOf(slug)
    if (i >= 0) {
      favorites.value.splice(i, 1)
    } else {
      favorites.value.push(slug)
    }
  }

  function isFavorite(slug: string): boolean {
    return favorites.value.includes(slug)
  }

  return { favorites, toggle, isFavorite }
}
