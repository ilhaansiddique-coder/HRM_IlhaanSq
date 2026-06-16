import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-base-content/35 font-medium no-animation ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground border-transparent shadow-sm hover:bg-destructive/90",
        outline: "border-base-content/40 bg-base-100 text-base-content hover:bg-base-200",
        secondary: "bg-secondary text-secondary-foreground border-transparent shadow-sm hover:bg-secondary/80",
        ghost: "border-base-content/35 bg-base-100 hover:bg-base-200 shadow-none",
        link: "text-primary border-transparent bg-transparent shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 min-h-10 px-4",
        sm: "btn-sm h-9 min-h-9 px-3",
        lg: "btn-lg h-11 min-h-11 px-8",
        icon: "btn-square h-11 min-h-0 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
