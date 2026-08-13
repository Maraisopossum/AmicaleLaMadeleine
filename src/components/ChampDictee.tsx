import { useEffect, useId, useRef, useState } from 'react'

type SpeechRecognitionResultLike = { transcript: string }
type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>
}
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined
}

type ChampDicteeProps = {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

export default function ChampDictee({ label, value, onChange, rows = 4, placeholder }: ChampDicteeProps) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseValueRef = useRef('')
  const accumuleRef = useRef('')
  const supported = !!getSpeechRecognitionCtor()
  const id = useId()

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const toggleDictee = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    baseValueRef.current = value
    accumuleRef.current = ''

    const recognition = new Ctor()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      let texte = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        texte += event.results[i][0].transcript
      }
      accumuleRef.current = accumuleRef.current ? `${accumuleRef.current} ${texte}` : texte
      const base = baseValueRef.current
      onChange(base ? `${base} ${accumuleRef.current}` : accumuleRef.current)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }

  return (
    <div className="mb-md">
      <div className="flex items-center justify-between mb-xs">
        <label htmlFor={id} className="block text-xs uppercase tracking-[0.1em] font-semibold text-brand-petrol">{label}</label>
        {supported && (
          <button
            type="button"
            onClick={toggleDictee}
            className={`text-xs font-semibold hover:underline print:hidden ${listening ? 'text-brand-brick' : 'text-brand-petrol'}`}
          >
            {listening ? '● Arrêter la dictée' : '🎙 Dicter'}
          </button>
        )}
      </div>
      <textarea
        id={id}
        aria-label={label || 'Contenu de la section'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full border border-brand-hairline bg-brand-parchment px-md py-sm focus:outline-none focus:border-brand-petrol resize-none"
      />
    </div>
  )
}
