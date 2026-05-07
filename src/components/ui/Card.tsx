import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Card = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'elevated' | 'outline' | 'ghost';
    interactive?: boolean;
  }
>(({ className, variant = 'default', interactive = false, ...props }, ref) => {
  const variants = {
    default: 'card bg-base-100 shadow-sm border border-base-300/40',
    elevated: 'card bg-base-100 shadow-lg border border-base-300/30',
    outline: 'card bg-base-100 border-2 border-base-300',
    ghost: 'card bg-transparent border-0',
  };

  const interactiveClasses = interactive
    ? 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.99]'
    : '';

  return (
    <div
      ref={ref}
      className={cn(variants[variant], interactiveClasses, className)}
      {...props}
    />
  );
});
Card.displayName = 'Card';

const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('card-body pb-2', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('card-title text-lg', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm opacity-60', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('card-body pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('card-body pt-0 flex-row items-center', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
