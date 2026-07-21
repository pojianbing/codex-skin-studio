import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors outline-none data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-4 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
