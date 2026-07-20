import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

export function AppearanceToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const nextLabel = isLight ? '切换至深色模式' : '切换至浅色模式'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      title={nextLabel}
      aria-label={nextLabel}
      aria-pressed={isLight}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="appearance-toggle cursor-pointer"
    >
      {isLight ? <Moon size={14} /> : <Sun size={14} />}
    </Button>
  )
}
