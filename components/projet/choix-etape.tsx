"use client"

import { PHASES } from "@/lib/referentiel"
import { CHAMP } from "@/components/dialogue"

// Liste des étapes de la méthode, pour rattacher un élément du dossier ou
// une réponse d'Archiaccess AI jointe à une étape du projet.
export function ChoixEtape({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP}>
      <option value="">Projet (aucune étape)</option>
      {PHASES.map((ph) => (
        <optgroup key={ph.numero} label={`Phase ${ph.numero} · ${ph.titre}`}>
          {ph.etapes.map((e) => (
            <option key={e.code} value={e.code}>
              {e.code} {e.titre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
