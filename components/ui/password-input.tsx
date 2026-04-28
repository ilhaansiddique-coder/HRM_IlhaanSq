import * as React from "react";
import { Eye, EyeClosed } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  wrapperClassName?: string;
  toggleClassName?: string;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, wrapperClassName, toggleClassName, visible, onVisibleChange, ...props }, ref) => {
    const [internalVisible, setInternalVisible] = React.useState(false);
    const isControlled = typeof visible === "boolean";
    const isVisible = isControlled ? visible : internalVisible;

    const handleVisibilityChange = (nextVisible: boolean) => {
      if (!isControlled) {
        setInternalVisible(nextVisible);
      }
      onVisibleChange?.(nextVisible);
    };

    return (
      <div className={cn("relative", wrapperClassName)}>
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          className={cn(
            "absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground",
            toggleClassName,
          )}
          onClick={() => handleVisibilityChange(!isVisible)}
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          {isVisible ? <Eye className="h-4 w-4" /> : <EyeClosed className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
