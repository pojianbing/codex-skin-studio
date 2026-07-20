import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect } from 'react'
import { useTheme } from 'next-themes'

export function NativeThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!isTauri()) return

    void getCurrentWindow().setTheme(resolvedTheme === 'light' ? 'light' : 'dark')
  }, [resolvedTheme])

  return null
}
