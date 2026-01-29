import * as React from "react"
import { cn } from "@/lib/utils"

export interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; icon?: React.ReactNode }[]
  className?: string
}

export function SegmentedControl({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg bg-bg-secondary p-1 border border-border-default",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            "flex items-center gap-2",
            value === option.value
              ? "bg-accent-primary text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}


