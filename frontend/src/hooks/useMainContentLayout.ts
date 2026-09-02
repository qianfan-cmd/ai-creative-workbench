import { useEffect } from 'react'
import layoutStyles from '@/layouts/MainLayout.module.css'

interface MainContentLayoutOptions {
  lockScroll?: boolean
  fullBleed?: boolean
}

export function useMainContentLayout(options: MainContentLayoutOptions = {}) {
  const { lockScroll = false, fullBleed = false } = options

  useEffect(() => {
    const main = document.getElementById('main-content')
    const inner = document.getElementById('content-inner')

    if (lockScroll && main) {
      main.classList.add(layoutStyles.content_lockScroll)
    }
    if (fullBleed && inner) {
      inner.classList.add(layoutStyles.contentInner_fullBleed)
    }

    return () => {
      if (lockScroll && main) {
        main.classList.remove(layoutStyles.content_lockScroll)
      }
      if (fullBleed && inner) {
        inner.classList.remove(layoutStyles.contentInner_fullBleed)
      }
    }
  }, [lockScroll, fullBleed])
}
