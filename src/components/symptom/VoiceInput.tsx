'use client'

// ── VoiceInput ────────────────────────────────────────────────────────────────
//
// Microphone button that captures speech via the Web Speech API.
// Calls onTranscript with the recognised text when speech ends.
// Renders nothing if the browser doesn't support SpeechRecognition.

import { useEffect }              from 'react'
import { useSpeechRecognition }   from '@/hooks/useSpeechRecognition'

// ── Props ─────────────────────────────────────────────────────────────────────

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?:    boolean
}

// ── Mic icon ──────────────────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Capsule body */}
      <rect x="9" y="2" width="6" height="11" rx="3" />
      {/* Stand arc */}
      <path d="M5 10a7 7 0 0 0 14 0" />
      {/* Stem */}
      <line x1="12" y1="17" x2="12" y2="21" />
      {/* Base */}
      <line x1="9"  y1="21" x2="15" y2="21" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition()

  // Fire onTranscript as soon as a non-empty final result arrives.
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript)
      stopListening()
    }
  // onTranscript is a new reference each render; intentionally exclude it from deps
  // to avoid double-fires — the hook resets transcript on each startListening call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, stopListening])

  // Not supported → render nothing so the form layout is unaffected.
  if (!isSupported) return null

  function handleClick() {
    if (disabled) return
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Microphone button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        aria-pressed={isListening}
        className={[
          'relative flex items-center justify-center',
          'w-9 h-9 rounded-full border transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mq-primary focus-visible:ring-offset-2',
          disabled
            ? 'opacity-40 cursor-not-allowed border-mq-border text-mq-text-3'
            : isListening
              ? 'bg-[var(--color-mq-error)] border-[var(--color-mq-error)] text-white animate-[pulse_1s_ease-in-out_infinite]'
              : 'bg-mq-surface-raised border-mq-border text-mq-text-2 hover:border-mq-primary hover:text-mq-primary',
        ].join(' ')}
      >
        <MicIcon className="w-4 h-4" />

        {/* Red ring pulse when listening */}
        {isListening && (
          <span
            className="absolute inset-0 rounded-full border-2 border-[var(--color-mq-error)] animate-ping opacity-60"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Status label */}
      <span
        className={[
          'text-[9px] font-mono tabular-nums select-none transition-colors',
          isListening ? 'text-[var(--color-mq-error)]' : 'text-mq-text-3',
        ].join(' ')}
        aria-live="polite"
      >
        {isListening ? 'Listening…' : 'Voice'}
      </span>

      {/* Inline error (small, non-blocking) */}
      {error && !isListening && (
        <p className="text-[9px] text-mq-error max-w-[120px] text-center leading-tight mt-0.5">
          {error}
        </p>
      )}
    </div>
  )
}
