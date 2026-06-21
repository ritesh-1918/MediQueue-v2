// ── useSpeechRecognition ──────────────────────────────────────────────────────
//
// Thin wrapper around the Web Speech API's SpeechRecognition interface.
// No external dependencies — uses the browser-native API directly.
// Supported in Chrome 25+ and Edge 79+. Falls back gracefully (isSupported=false)
// on Firefox, Safari, and server-side rendering.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Browser type declarations ─────────────────────────────────────────────────
// @types/web includes SpeechRecognition but it's not always picked up
// correctly inside Next.js — declare the minimal surface we use here.

declare global {
  interface Window {
    SpeechRecognition:       typeof SpeechRecognition | undefined
    webkitSpeechRecognition: typeof SpeechRecognition | undefined
  }

  class SpeechRecognition extends EventTarget {
    continuous:      boolean
    interimResults:  boolean
    lang:            string
    maxAlternatives: number
    start(): void
    stop():  void
    abort(): void
    onresult:     ((event: SpeechRecognitionEvent)      => void) | null
    onerror:      ((event: SpeechRecognitionErrorEvent) => void) | null
    onend:        (() => void) | null
    onstart:      (() => void) | null
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results:     SpeechRecognitionResultList
  }

  interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean
    readonly length:  number
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error:   string
    readonly message: string
  }
}

// ── Error humaniser ───────────────────────────────────────────────────────────

function humaniseError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'permission-denied':
      return 'Microphone access denied — allow it in your browser settings.'
    case 'no-speech':
      return 'No speech detected. Please try speaking again.'
    case 'audio-capture':
      return 'Microphone not found. Please check your audio device.'
    case 'network':
      return 'Network error during speech recognition. Check your connection.'
    case 'aborted':
      return 'Listening was cancelled.'
    case 'service-not-allowed':
      return 'Speech recognition is not allowed on this page.'
    default:
      return `Speech error: ${code}`
  }
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface SpeechRecognitionHook {
  isSupported:    boolean
  isListening:    boolean
  transcript:     string
  error:          string | null
  startListening: () => void
  stopListening:  () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [error,       setError]       = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Compute support once — false during SSR, true if the browser has the API.
  const isSupported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition != null || window.webkitSpeechRecognition != null)

  // ── Bootstrap the SpeechRecognition instance (lazy, once) ────────────────

  function getRecognition(): SpeechRecognition | null {
    if (!isSupported) return null
    if (recognitionRef.current) return recognitionRef.current

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return null

    const r = new Ctor()
    r.continuous     = false   // stop after one utterance
    r.interimResults = true    // stream partial results
    r.lang           = navigator.language || 'en-US'

    r.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript
        }
      }
      if (finalText) setTranscript(finalText.trim())
    }

    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'aborted' fires when we call r.abort() ourselves — not a real error.
      if (event.error !== 'aborted') {
        setError(humaniseError(event.error))
      }
      setIsListening(false)
    }

    r.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = r
    return r
  }

  // ── API ───────────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    const r = getRecognition()
    if (!r) return
    setError(null)
    setTranscript('')
    try {
      r.start()
      setIsListening(true)
    } catch {
      // start() throws DOMException if already running — safe to ignore.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  return { isSupported, isListening, transcript, error, startListening, stopListening }
}
