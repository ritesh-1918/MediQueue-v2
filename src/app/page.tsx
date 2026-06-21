import Link from 'next/link'

// ── Feature cards data ────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🔍',
    title: 'AI Symptom Check',
    description:
      'Answer a few questions and let the AI assess urgency before you even reach the desk.',
    href: '/symptom-check',
    cta: 'Try now',
    accent: 'border-mq-primary/40 hover:border-mq-primary',
    badge: 'Free · No account needed',
  },
  {
    icon: '🎟️',
    title: 'Real-time Queue',
    description:
      'Book a token and watch your position update live — no need to stay glued to a counter.',
    href: '/patient',
    cta: 'Book token',
    accent: 'border-mq-border hover:border-mq-border-strong',
    badge: 'Live updates',
  },
  {
    icon: '🩺',
    title: 'Doctor Dashboard',
    description:
      'Call the next patient, mark consultations done, and track your session stats in one view.',
    href: '/doctor',
    cta: 'Open dashboard',
    accent: 'border-mq-border hover:border-mq-border-strong',
    badge: 'For doctors',
  },
  {
    icon: '⚙️',
    title: 'Admin Control',
    description:
      'Manage doctors, monitor queue health, and view clinic-wide activity in real time.',
    href: '/admin',
    cta: 'Go to admin',
    accent: 'border-mq-border hover:border-mq-border-strong',
    badge: 'For staff',
  },
]

// ── Nav links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Patient Portal', href: '/patient' },
  { label: 'Symptom Check', href: '/symptom-check' },
  { label: 'Doctor Login',  href: '/login'   },
  { label: 'Admin',         href: '/admin'   },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-4 pt-20 pb-16">
        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-mq-primary/30 bg-mq-primary/10 text-mq-primary text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-mq-primary animate-pulse" />
          AI-powered clinic management · Live
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-mq-text-1 tracking-tight leading-tight max-w-3xl">
          Smart Clinic{' '}
          <span className="text-mq-primary">Queue</span>{' '}
          Management
        </h1>

        <p className="mt-4 text-lg text-mq-text-2 max-w-xl leading-relaxed">
          AI-powered patient flow — no more waiting room chaos.
          <br className="hidden sm:block" />
          From triage to consultation, every step is tracked in real time.
        </p>

        {/* Primary CTA row */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            href="/patient"
            className="px-6 py-3 rounded-lg bg-mq-primary text-white text-sm font-semibold
                       hover:bg-mq-primary-hover transition-colors"
          >
            Book a Token →
          </Link>
          <Link
            href="/symptom-check"
            className="px-6 py-3 rounded-lg border border-mq-border text-mq-text-1 text-sm font-semibold
                       hover:border-mq-border-strong hover:bg-mq-surface transition-colors"
          >
            Check Symptoms
          </Link>
        </div>
      </section>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <section className="flex-1 max-w-5xl mx-auto w-full px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className={`group flex flex-col gap-3 p-5 rounded-xl border bg-mq-surface transition-all duration-150 ${f.accent}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl">{f.icon}</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-mq-border text-mq-text-3">
                  {f.badge}
                </span>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-mq-text-1 mb-1">{f.title}</h2>
                <p className="text-xs text-mq-text-2 leading-relaxed">{f.description}</p>
              </div>

              <span className="mt-auto text-xs font-medium text-mq-primary group-hover:underline underline-offset-2">
                {f.cta} →
              </span>
            </Link>
          ))}
        </div>

        {/* ── Nav quick-links ─────────────────────────────────────────────── */}
        <nav
          aria-label="Quick navigation"
          className="mt-10 flex flex-wrap gap-2 justify-center"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-lg border border-mq-border text-xs text-mq-text-2
                         hover:border-mq-border-strong hover:text-mq-text-1 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-mq-border py-4 px-4 text-center text-[11px] text-mq-text-3">
        MediQueue — clinic queue system · Built with Next.js &amp; Supabase
      </footer>
    </div>
  )
}
