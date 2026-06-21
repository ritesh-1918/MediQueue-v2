import { type ReactNode, type HTMLAttributes } from 'react'

// ── Variant maps ──────────────────────────────────────────────────────────────

const paddingStyles = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
} as const

const borderStyles = {
  default: 'border border-mq-border',
  strong:  'border border-mq-border-strong',
  none:    '',
} as const

// ── Sub-components ────────────────────────────────────────────────────────────

interface CardTitleProps {
  children: ReactNode
  className?: string
  action?: ReactNode   // optional right-aligned slot (e.g. a badge or button)
}

export function CardTitle({ children, className = '', action }: CardTitleProps) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <h3 className="text-sm font-semibold text-mq-text-1 tracking-wide">
        {children}
      </h3>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardDivider({ className = '' }: { className?: string }) {
  return <hr className={`border-mq-border my-3 ${className}`} />
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?:  keyof typeof paddingStyles
  border?:   keyof typeof borderStyles
  hoverable?: boolean
  children:  ReactNode
}

export function Card({
  padding  = 'md',
  border   = 'default',
  hoverable = false,
  children,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        'bg-mq-surface rounded-xl',
        paddingStyles[padding],
        borderStyles[border],
        hoverable
          ? 'transition-colors duration-150 hover:bg-mq-surface-hover hover:border-mq-border-strong cursor-pointer'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

// ── Stat card — used in admin StatsRow ────────────────────────────────────────

interface StatCardProps {
  label:     string
  value:     string | number
  sub?:      string
  accent?:   'teal' | 'green' | 'amber' | 'red' | 'purple'
  className?: string
}

const accentText = {
  teal:   'text-mq-primary',
  green:  'text-mq-success',
  amber:  'text-mq-warning',
  red:    'text-mq-error',
  purple: 'text-mq-purple',
} as const

export function StatCard({ label, value, sub, accent = 'teal', className = '' }: StatCardProps) {
  return (
    <Card className={className}>
      <p className="text-xs text-mq-text-2 mb-1">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${accentText[accent]}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-mq-text-3 mt-1">{sub}</p>}
    </Card>
  )
}
