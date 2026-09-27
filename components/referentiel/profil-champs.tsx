"use client"

import { MISSIONS, MONTAGES, STATUTS_MOA, TYPOLOGIES } from "@/lib/referentiel/libelles"

// Champs du profil d'une opération (trois axes + mission + réhabilitation),
// partagés par la création d'un projet et l'édition de son profil.

export interface ProfilSaisi {
  statutMoa: string
  montage: string
  typologie: string
  mission: string
  rehabilitation: boolean
}

export const PROFIL_VIDE: ProfilSaisi = { statutMoa: "", montage: "", typologie: "", mission: "", rehabilitation: false }

const CHAMPS: { cle: keyof Omit<ProfilSaisi, "rehabilitation">; label: string; valeurs: Record<string, string> }[] = [
  { cle: "statutMoa", label: "Statut du maître d'ouvrage", valeurs: STATUTS_MOA },
  { cle: "montage", label: "Montage contractuel", valeurs: MONTAGES },
  { cle: "typologie", label: "Typologie d'ouvrage", valeurs: TYPOLOGIES },
  { cle: "mission", label: "Mission Archiaccess", valeurs: MISSIONS },
]

export function ProfilChamps({ valeur, onChange }: { valeur: ProfilSaisi; onChange: (v: ProfilSaisi) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CHAMPS.map(({ cle, label, valeurs }) => (
        <label key={cle} className="block">
          <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
          <select
            value={valeur[cle]}
            onChange={(e) => onChange({ ...valeur, [cle]: e.target.value })}
            className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          >
            <option value="">— À renseigner —</option>
            {Object.entries(valeurs).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={valeur.rehabilitation} onChange={(e) => onChange({ ...valeur, rehabilitation: e.target.checked })} />
        Réhabilitation ou travaux en site occupé
      </label>
    </div>
  )
}

// Corps de requête : chaîne vide envoyée comme null (axe non renseigné).
export function profilVersRequete(p: ProfilSaisi) {
  return {
    statutMoa: p.statutMoa || null,
    montage: p.montage || null,
    typologie: p.typologie || null,
    mission: p.mission || null,
    rehabilitation: p.rehabilitation,
  }
}
