import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, helperText, startIcon, endIcon, ...props }, ref) => {
    return (
      <div className="form-control w-full">
        <div className="relative">
          {startIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none">
              {startIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              'input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-colors',
              startIcon && 'pl-10',
              endIcon && 'pr-10',
              error && 'input-error',
              className
            )}
            ref={ref}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40">
              {endIcon}
            </div>
          )}
        </div>
        {helperText && (
          <label className="label">
            <span className={cn('label-text-alt', error ? 'text-error' : 'opacity-60')}>
              {helperText}
            </span>
          </label>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
