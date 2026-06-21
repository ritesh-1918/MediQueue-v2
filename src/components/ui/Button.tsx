'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

// ── Variant & size maps ───────────────────────────────────────────────────────

const variantStyles = {
  primary:   'bg-mq-primary hover:bg-mq-primary-hover text-white border border-mq-primary/50 shadow-sm',
  secondary: 'bg-mq-surface hover:bg-mq-surface-hover text-mq-text-1 border border-mq-border hover:border-mq-border-strong',
  success:   'bg-mq-success-bg hover:bg-green-900/40 text-mq-success border border-mq-success/30',
  warning:   'bg-mq-warning-bg hover:bg-amber-900/40 text-mq-warning border border-mq-warning/30',
  danger:    'bg-mq-error-bg hover:bg-red-900/40 text-mq-error border border-mq-error/30',
  ghost:     'bg-transparent hover:bg-mq-surface text-mq-text-2 hover:text-mq-text-1 border border-transparent hover:border-mq-border',
} as const

const sizeStyles = {
  sm:   'h-7 px-3 text-xs gap-1.5',
  md:   'h-9 px-4 text-sm gap-2',
  lg:   'h-11 px-5 text-base gap-2.5',
  icon: 'h-9 w-9 p-0',
} as const

type Variant = keyof typeof variantStyles
type Size    = keyof typeof sizeStyles

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner({ size }: { size: Size }) {
  const dim = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <svg
      className={`${dim} animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:     Variant
  size?:        Size
  loading?:     boolean
  loadingText?: string
  leftIcon?:    ReactNode
  rightIcon?:   ReactNode
  fullWidth?:   boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant     = 'primary',
      size        = 'md',
      loading     = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth   = false,
      disabled,
      children,
      className   = '',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-150 cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? (
          <>
            <Spinner size={size} />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
