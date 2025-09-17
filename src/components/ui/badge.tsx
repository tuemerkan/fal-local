import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Subtle colored variants for model categories
        "text-to-image":
          "border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
        "image-to-image":
          "border-transparent bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400",
        "text-to-video":
          "border-transparent bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
        "image-to-video":
          "border-transparent bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
        "video-to-video":
          "border-transparent bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400",
        training:
          "border-transparent bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
