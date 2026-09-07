"use client"

// Champ de saisie multi-ligne qui grandit avec le contenu (jusqu'à
// maxRows, puis défile) — remplace un <input> une ligne là où l'employé
// peut avoir besoin de coller un texte long (ex : un article de loi à
// faire expliquer). Entrée envoie, Maj+Entrée passe à la ligne, comme
// les chats modernes. Partagé entre app/ai/page.tsx et le panneau IA de
// app/sit/page.tsx, qui appellent tous les deux /api/mistral/chat.

import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react"

interface AutoGrowTextareaProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxRows?: number
  autoFocus?: boolean
}

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(function AutoGrowTextarea(
  { value, onChange, onSubmit, placeholder, className, disabled, maxRows = 8, autoFocus },
  forwardedRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "20") || 20
    const maxHeight = lineHeight * maxRows
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [value, maxRows])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!disabled) onSubmit()
    }
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
    />
  )
})
