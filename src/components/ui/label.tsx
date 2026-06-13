"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, id, htmlFor, ...props }, forwardedRef) => {
  const generatedId = React.useId();
  const labelRef = React.useRef<React.ElementRef<typeof LabelPrimitive.Root>>(null);
  const labelId = id ?? generatedId;

  React.useImperativeHandle(forwardedRef, () => labelRef.current as React.ElementRef<typeof LabelPrimitive.Root>);

  React.useEffect(() => {
    if (htmlFor || !labelRef.current) return;
    const container = labelRef.current.parentElement;
    const control = container?.querySelector<HTMLElement>("input, textarea, button[role='combobox']");
    if (!control || control.hasAttribute("aria-label") || control.hasAttribute("aria-labelledby")) return;
    control.setAttribute("aria-labelledby", labelId);
  }, [htmlFor, labelId]);

  return (
    <LabelPrimitive.Root
      ref={labelRef}
      id={labelId}
      htmlFor={htmlFor}
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
