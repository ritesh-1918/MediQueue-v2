import type { QueueStatus, ActivityLogType } from '@/lib/types'

// ── Badge variant maps ────────────────────────────────────────────────────────

const queueStatusStyles: Record<QueueStatus, { label: string; className: string }> = {
  waiting: {
    label: 'Waiting',
    className: 'bg-mq-surface-raised text-mq-text-2 border border-mq-border',
  },
  called: {
    label: 'Called',
    className: 'bg-mq-teal-bg text-mq-primary border border-mq-primary/30',
  },
  serving: {
    label: 'Serving',
    className: 'bg-mq-success-bg text-mq-success border border-mq-success/30',
  },
  done: {
    label: 'Done',
    className: 'bg-mq-surface text-mq-text-3 border border-mq-border-subtle',
  },
  skipped: {
    label: 'Skipped',
    className: 'bg-mq-warning-bg text-mq-warning border border-mq-warning/30',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-mq-error-bg text-mq-error border border-mq-error/30',
  },
}

const activityTypeStyles: Record<ActivityLogType, { className: string }> = {
  info:    { className: 'bg-mq-surface-raised text-mq-text-2 border border-mq-border' },
  success: { className: 'bg-mq-success-bg text-mq-success border border-mq-success/30' },
  warning: { className: 'bg-mq-warning-bg text-mq-warning border border-mq-warning/30' },
  error:   { className: 'bg-mq-error-bg text-mq-error border border-mq-error/30' },
}

// ── Size variants ─────────────────────────────────────────────────────────────

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
} as const

// ── Component ─────────────────────────────────────────────────────────────────

type BadgeSize = keyof typeof sizeStyles

interface QueueStatusBadgeProps {
  status: QueueStatus
  size?: BadgeSize
  className?: string
}

interface ActivityTypeBadgeProps {
  type: ActivityLogType
  label?: string
  size?: BadgeSize
  className?: string
}

interface GenericBadgeProps {
  label: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'purple'
  size?: BadgeSize
  className?: string
}

type BadgeProps =
  | ({ kind: 'status' } & QueueStatusBadgeProps)
  | ({ kind: 'activity' } & ActivityTypeBadgeProps)
  | ({ kind?: 'generic' } & GenericBadgeProps)

const genericVariantStyles: Record<NonNullable<GenericBadgeProps['variant']>, string> = {
  default: 'bg-mq-surface-raised text-mq-text-2 border border-mq-border',
  primary: 'bg-mq-teal-bg text-mq-primary border border-mq-primary/30',
  success: 'bg-mq-success-bg text-mq-success border border-mq-success/30',
  warning: 'bg-mq-warning-bg text-mq-warning border border-mq-warning/30',
  error:   'bg-mq-error-bg text-mq-error border border-mq-error/30',
  purple:  'bg-mq-purple-bg text-mq-purple border border-mq-purple/30',
}

export function Badge(props: BadgeProps) {
  const size = props.size ?? 'md'
  const base = `inline-flex items-center font-medium rounded-full tracking-wide ${sizeStyles[size]}`

  if (props.kind === 'status') {
    const { label, className: variantClass } = queueStatusStyles[props.status]
    return (
      <span className={`${base} ${variantClass} ${props.className ?? ''}`}>
        {label}
      </span>
    )
  }

  if (props.kind === 'activity') {
    const { className: variantClass } = activityTypeStyles[props.type]
    return (
      <span className={`${base} ${variantClass} ${props.className ?? ''}`}>
        {props.label ?? props.type}
      </span>
    )
  }

  // Generic badge
  const { label, variant = 'default', className = '' } = props as GenericBadgeProps
  return (
    <span className={`${base} ${genericVariantStyles[variant]} ${className}`}>
      {label}
    </span>
  )
}

// ── Convenience re-exports for the most common usage ─────────────────────────

export function StatusBadge({
  status,
  size,
  className,
}: {
  status: QueueStatus
  size?: BadgeSize
  className?: string
}) {
  return <Badge kind="status" status={status} size={size} className={className} />
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-mq-success-bg text-mq-success border border-mq-success/30">
      <span className="w-1.5 h-1.5 rounded-full bg-mq-success animate-pulse" />
      Live
    </span>
  )
}

export function OfflineBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-mq-surface-raised text-mq-text-3 border border-mq-border">
      <span className="w-1.5 h-1.5 rounded-full bg-mq-text-3" />
      Offline
    </span>
  )
}
