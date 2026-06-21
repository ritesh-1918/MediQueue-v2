'use client'

import { useEffect, useState } from 'react'

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'symptom', label: 'AI Symptom Check', icon: '🔍' },
  { key: 'patient', label: 'Patient',           icon: '👤' },
  { key: 'doctor',  label: 'Doctor',            icon: '🩺' },
  { key: 'admin',   label: 'Admin',             icon: '⚙' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface TopbarProps {
  activeTab?:  TabKey
  onTabChange?: (tab: TabKey) => void
}

// ── Live clock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <span className="font-mono text-xs text-mq-text-2 tabular-nums tracking-wider">
      {time}
    </span>
  )
}

// ── System status dot ─────────────────────────────────────────────────────────

function SystemStatus() {
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-mq-success animate-pulse" />
      <span className="text-xs text-mq-text-3">System Live</span>
    </div>
  )
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export function Topbar({ activeTab, onTabChange }: TopbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-mq-surface border-b border-mq-border">
      {/* Main bar */}
      <div className="flex items-center justify-between h-12 px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg
                       bg-mq-primary/10 border border-mq-primary/30
                       text-mq-primary text-base"
            aria-hidden="true"
          >
            ⚕
          </div>
          <span className="font-semibold text-mq-text-1 text-sm tracking-tight">
            MediQueue
          </span>
        </div>

        {/* Right side: status + clock */}
        <div className="flex items-center gap-4">
          <SystemStatus />
          <LiveClock />
        </div>
      </div>

      {/* Tab strip — only rendered when tab navigation is enabled */}
      {onTabChange && (
        <div
          className="flex border-t border-mq-border-subtle overflow-x-auto scrollbar-none"
          role="tablist"
          aria-label="View"
        >
          {TABS.map(({ key, label, icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(key)}
                className={[
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium',
                  'whitespace-nowrap transition-colors duration-150',
                  'border-b-2 -mb-px',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mq-primary',
                  isActive
                    ? 'border-mq-primary text-mq-primary bg-mq-primary/5'
                    : 'border-transparent text-mq-text-2 hover:text-mq-text-1 hover:bg-mq-surface-hover',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            )
          })}
        </div>
      )}
    </header>
  )
}

export type { TabKey }
