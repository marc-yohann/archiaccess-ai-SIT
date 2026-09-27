"use client"

import { AuthGate, useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { EtapeVue } from "@/components/referentiel/etape-vue"
import { PHASES, REFERENTIEL_VERSION } from "@/lib/referentiel"
import { AXES_INTRO, PRESENTATION, PRINCIPES } from "@/lib/referentiel/principes"
import { MONTAGES, STATUTS_MOA, TYPOLOGIES } from "@/lib/referentiel/libelles"

// Consultation du référentiel de méthode Archiaccess (AMO / OPC) — mêmes
// données que le PDF (scripts/referentiel-pdf.mjs) et que l'espace
// projet, source unique lib/referentiel. La maintenance de la méthode
// (version, statut de validation, points à préciser, fonctions prévues de
// l'outil) n'est montrée qu'aux administrateurs.
function Referentiel() {
  const { isAdmin } = useUser()
  return (
      <main className="glass-scene custom-scrollbar flex h-screen w-full items-start justify-center overflow-y-auto p-4">
        <div className="flex w-full max-w-5xl flex-col gap-4 pb-10">
          <SitNav titre="Méthode Archiaccess" />

          <div className="liquid-glass-panel rounded-2xl p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Méthode AMO / OPC{isAdmin ? ` — version ${REFERENTIEL_VERSION} — document de travail` : ""}
            </p>
            <p className="mt-2 text-sm">{PRESENTATION}</p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {PRINCIPES.filter((p) => isAdmin || !p.interne).map((p) => (
                <div key={p.titre} className="liquid-glass-soft rounded-xl p-3">
                  <p className="text-sm font-medium">{p.titre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.texte}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="liquid-glass-panel rounded-2xl p-5">
            <h2 className="text-sm font-medium">Les trois axes de variation</h2>
            <p className="mt-1 text-sm text-muted-foreground">{AXES_INTRO}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {[
                ["Statut du maître d'ouvrage", STATUTS_MOA],
                ["Montage contractuel", MONTAGES],
                ["Typologie d'ouvrage", TYPOLOGIES],
              ].map(([titre, valeurs]) => (
                <div key={titre as string} className="liquid-glass-soft rounded-xl p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{titre as string}</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm">
                    {Object.values(valeurs as Record<string, string>).map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {PHASES.map((phase) => (
            <section key={phase.numero} className="liquid-glass-panel rounded-2xl p-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Phase {phase.numero}</p>
              <h2 className="text-base font-semibold">{phase.titre}</h2>
              {phase.etapes.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Phase en cours de rédaction.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">{phase.intro}</p>
                  <div className="mt-3 space-y-2">
                    {phase.etapes.map((e) => (
                      <EtapeVue key={e.code} etape={e} admin={isAdmin} />
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}
        </div>
      </main>
  )
}

export default function ReferentielPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <Referentiel />
    </AuthGate>
  )
}
