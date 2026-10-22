'use client';

import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Warianty rozmiaru modala (Dark Art Déco - standard 75-80% powierzchni okna).
 * - `sm`    - drobne potwierdzenia (domyślny, ~max-w-lg, treść w grid).
 * - `lg`    - średni modal (~max-w-3xl) z przewijaniem.
 * - `wide`  - standard 75-80% okna (80vw / h-[78vh] / max-h-[85vh] + przewijanie).
 * - `screen`- pełny ekran 100% okna (100vw / 100vh), flex-col z wewnętrznym przewijaniem.
 */
const dialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] border border-brass/30 bg-card shadow-deco duration-200 data-[state=open]:animate-modal-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:rounded-lg',
  {
    variants: {
      size: {
        sm: 'grid w-full max-w-lg gap-4 p-6',
        lg: 'grid w-full max-w-3xl max-h-[86vh] gap-4 overflow-y-auto p-6',
        wide: 'grid w-[80vw] 2xl:w-[85vw] h-[78vh] 2xl:h-[84vh] max-h-[85vh] 2xl:max-h-[88vh] gap-4 overflow-y-auto p-6',
        screen:
          'deco-corners fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 h-screen max-h-screen w-screen max-w-none flex flex-col overflow-hidden p-0 sm:rounded-none rounded-none border-none',
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  }
);

export interface DialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  screenContentClassName?: string;
}

const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size, screenContentClassName, ...props }, ref) => {
  const t = useTranslations('Dialog');

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogContentVariants({ size }), className)}
        {...props}
      >
        {size === 'screen' ? (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto p-6',
              screenContentClassName
            )}
          >
            {children}
          </div>
        ) : (
          children
        )}

        <DialogPrimitive.Close className="absolute right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-brass/35 bg-[#120f0c] text-muted-foreground opacity-95 shadow-lg ring-offset-background backdrop-blur-sm transition-all hover:border-brass/70 hover:text-brass hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none">
          <X className="h-5 w-5" />
          <span className="sr-only">{t('close')}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'font-display text-lg font-semibold leading-none tracking-wide text-foreground',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
