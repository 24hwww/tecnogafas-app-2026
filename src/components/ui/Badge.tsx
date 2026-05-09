import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('badge', {
  variants: {
    variant: {
      default: 'badge-primary',
      secondary: 'badge-secondary',
      destructive: 'badge-error',
      outline: 'badge-outline',
      success: 'badge-success',
      warning: 'badge-warning',
      info: 'badge-info',
    },
    size: {
      default: 'badge-md',
      sm: 'badge-sm',
      lg: 'badge-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
