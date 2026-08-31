"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Send, Sparkles } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import type { AddressResult } from "@/lib/data-sources/ban"
import type { Parcel } from "@/lib/data-sources/cadastre"
import type { CommuneRisks } from "@/lib/data-sources/georisques"
import type { Mutation } from "@/lib/data-sources/dvf"
import type { Company } from "@/lib/data-sources/entreprises"
import type { UrbanZone } from "@/lib/data-sources/urbanisme"
import type { DpeRecord } from "@/lib/data-sources/dpe"
import type { BodaccAnnouncement } from "@/lib/data-sources/bodacc"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// Instantané des données actuellement chargées dans le tableau de bord —
// passé explicitement à formatContext()/sendAiMessage() plutôt que lu
// depuis le state React, pour éviter de capturer des valeurs pas encore
// à jour (setState est asynchrone : juste après un setParcels(...), le
// state "parcels" du closure courant peut encore être l'ancien).
interface SitSnapshot {
  address?: AddressResult | null
  parcels?: Parcel[] | null
  risks?: CommuneRisks | null
  mutations?: Mutation[] | null
  urbanZones?: UrbanZone[] | null
  dpeRecords?: DpeRecord[] | null
  companies?: Company[]
  bodaccBySiren?: Record<string, BodaccAnnouncement[]>
}

function formatContext(s: SitSnapshot): string {
  const parts: string[] = []
  if (s.address) {
    parts.push(`Adresse sélectionnée : ${s.address.label} (${s.address.postcode} ${s.address.city}, code INSEE ${s.address.citycode})`)
  }
  if (s.parcels?.[0]) {
    const p = s.parcels[0]
    parts.push(`Parcelle cadastrale : section ${p.section} n°${p.numero}, ${p.contenanceM2} m², identifiant ${p.idu}`)
  }
  if (s.risks) {
    const riskLabels = s.risks.risks.map((r) => r.label).join(", ") || "aucun risque recensé"
    parts.push(
      `Risques (commune ${s.risks.commune}) : zone sismique ${s.risks.seismicZone ?? "non renseignée"}, potentiel radon ${s.risks.radonPotential ?? "non renseigné"}, risques : ${riskLabels}`,
    )
  }
  if (s.urbanZones && s.urbanZones.length > 0) {
    parts.push(`Urbanisme (PLU/POS) : ${s.urbanZones.map((z) => `${z.description} (${z.label}${z.type ? `, type ${z.type}` : ""})`).join(" ; ")}`)
  }
  if (s.mutations && s.mutations.length > 0) {
    const last = s.mutations[0]
    parts.push(
      `DVF : ${s.mutations.length} vente(s) recensée(s) sur cette section, la plus récente le ${last.date}${last.valeurFonciere ? ` pour ${last.valeurFonciere.toLocaleString("fr-FR")} €` : ""}.`,
    )
  }
  if (s.dpeRecords && s.dpeRecords.length > 0) {
    const labels = s.dpeRecords.map((d) => d.etiquetteEnergie).filter(Boolean).join(", ")
    parts.push(`DPE à proximité : ${s.dpeRecords.length} diagnostic(s) trouvé(s), étiquettes énergie : ${labels || "non renseignées"}.`)
  }
  if (s.companies && s.companies.length > 0) {
    parts.push(
      `Entreprises trouvées : ${s.companies
        .map((c) => {
          const announcements = s.bodaccBySiren?.[c.siren] ?? []
          const bodacc =
            announcements.length > 0
              ? ` — BODACC : ${announcements.length} annonce(s), la plus récente : ${announcements[0].famille} le ${announcements[0].datePublication}`
              : ""
          return `${c.nom} (SIREN ${c.siren}${c.adresse ? `, ${c.adresse}` : ""}, ${c.etatAdministratif ?? "statut inconnu"})${bodacc}`
        })
        .join(" ; ")}`,
    )
  }
  return parts.join("\n")
}

// Tableau de bord du SIT : recherche universelle (adresse OU entreprise —
// voir CLAUDE.md, "je veux pas que ce soit l'adresse seulement"), tous
// les résultats affichés simultanément en tuiles denses plutôt qu'un
// formulaire séquentiel, avec un panneau Archiaccess AI intégré qui
// résume automatiquement les données chargées et répond aux questions
// dessus (contexte transmis à /api/mistral/chat).
export default function SitPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <Dashboard />
    </AuthGate>
  )
}

function Dashboard() {
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const [addresses, setAddresses] = useState<AddressResult[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [bodaccBySiren, setBodaccBySiren] = useState<Record<string, BodaccAnnouncement[]>>({})

  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null)
  const [parcels, setParcels] = useState<Parcel[] | null>(null)
  const [risks, setRisks] = useState<CommuneRisks | null>(null)
  const [mutations, setMutations] = useState<Mutation[] | null>(null)
  const [urbanZones, setUrbanZones] = useState<UrbanZone[] | null>(null)
  const [dpeRecords, setDpeRecords] = useState<DpeRecord[] | null>(null)

  const [aiConversationId, setAiConversationId] = useState<string>()
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([])
  const [aiInput, setAiInput] = useState("")
  const [isAiSending, setIsAiSending] = useState(false)

  async function sendAiMessage(text: string, snapshot: SitSnapshot) {
    if (!text.trim() || isAiSending) return
    setAiMessages((prev) => [...prev, { role: "user", content: text }])
    setIsAiSending(true)
    try {
      const res = await fetch("/api/mistral/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: aiConversationId, message: text, context: formatContext(snapshot) }),
      })
      const data = await res.json()
      if (data.success) {
        setAiConversationId(data.conversationId)
        setAiMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
      } else {
        setAiMessages((prev) => [...prev, { role: "assistant", content: `Erreur : ${data.error}` }])
      }
    } finally {
      setIsAiSending(false)
    }
  }

  async function submitAiInput(e: React.FormEvent) {
    e.preventDefault()
    const text = aiInput.trim()
    if (!text) return
    setAiInput("")
    await sendAiMessage(text, { address: selectedAddress, parcels, risks, mutations, urbanZones, dpeRecords, companies, bodaccBySiren })
  }

  async function loadBodacc(currentCompanies: Company[]): Promise<Record<string, BodaccAnnouncement[]>> {
    if (currentCompanies.length === 0) return {}
    const entries = await Promise.all(
      currentCompanies.map(async (c) => {
        const res = await fetch(`/api/sit/bodacc?siren=${c.siren}`).then((r) => r.json())
        return [c.siren, res.success ? (res.announcements as BodaccAnnouncement[]) : []] as const
      }),
    )
    return Object.fromEntries(entries)
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || isSearching) return
    setIsSearching(true)
    setError("")
    setSelectedAddress(null)
    setParcels(null)
    setRisks(null)
    setMutations(null)
    setUrbanZones(null)
    setDpeRecords(null)
    setBodaccBySiren({})
    setAiConversationId(undefined)
    setAiMessages([])
    try {
      const res = await fetch(`/api/sit/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? "Recherche impossible.")
        setAddresses([])
        setCompanies([])
        return
      }
      const foundAddresses: AddressResult[] = data.addresses
      const foundCompanies: Company[] = data.companies
      setAddresses(foundAddresses)
      setCompanies(foundCompanies)

      if (foundAddresses.length === 0 && foundCompanies.length === 0) {
        setError("Aucun résultat pour cette recherche.")
        return
      }

      const bodacc = await loadBodacc(foundCompanies)
      setBodaccBySiren(bodacc)

      if (foundAddresses.length === 0 && foundCompanies.length > 0) {
        // Que des entreprises : rien à sélectionner, on peut résumer tout de suite.
        void sendAiMessage(
          "Fais un résumé synthétique des informations ci-dessus, pertinent pour une étude AMO/OPC (par exemple pour vérifier un partenaire de groupement). Sois concis (5-8 lignes maximum).",
          { companies: foundCompanies, bodaccBySiren: bodacc },
        )
      }
    } finally {
      setIsSearching(false)
    }
  }

  async function selectAddress(addr: AddressResult) {
    setSelectedAddress(addr)
    setParcels(null)
    setRisks(null)
    setMutations(null)
    setUrbanZones(null)
    setDpeRecords(null)

    const [lon, lat] = addr.coordinates
    const [parcelsRes, risksRes, urbanismeRes, dpeRes] = await Promise.all([
      fetch(`/api/sit/parcels?lon=${lon}&lat=${lat}`).then((r) => r.json()),
      fetch(`/api/sit/risks?codeInsee=${addr.citycode}`).then((r) => r.json()),
      fetch(`/api/sit/urbanisme?lon=${lon}&lat=${lat}`).then((r) => r.json()),
      fetch(`/api/sit/dpe?lon=${lon}&lat=${lat}`).then((r) => r.json()),
    ])

    const loadedParcels: Parcel[] = parcelsRes.success ? parcelsRes.parcels : []
    const loadedRisks: CommuneRisks | null = risksRes.success ? risksRes.risks : null
    const loadedUrbanZones: UrbanZone[] = urbanismeRes.success ? urbanismeRes.zones : []
    const loadedDpe: DpeRecord[] = dpeRes.success ? dpeRes.records : []
    setParcels(loadedParcels)
    setRisks(loadedRisks)
    setUrbanZones(loadedUrbanZones)
    setDpeRecords(loadedDpe)

    let loadedMutations: Mutation[] = []
    if (loadedParcels[0]) {
      const dvfRes = await fetch(
        `/api/sit/dvf?codeCommune=${loadedParcels[0].codeInsee}&sectionPrefixe=${loadedParcels[0].sectionPrefixe}`,
      ).then((r) => r.json())
      if (dvfRes.success) loadedMutations = dvfRes.mutations
    }
    setMutations(loadedMutations)

    void sendAiMessage(
      "Fais un résumé synthétique des informations ci-dessus (adresse, cadastre, urbanisme, risques, DVF, DPE), pertinent pour une étude technique AMO/OPC. Sois concis (5-8 lignes maximum), et signale si une donnée importante manque.",
      {
        address: addr,
        parcels: loadedParcels,
        risks: loadedRisks,
        mutations: loadedMutations,
        urbanZones: loadedUrbanZones,
        dpeRecords: loadedDpe,
        companies,
        bodaccBySiren,
      },
    )
  }

  const hasTiles = selectedAddress || companies.length > 0

  return (
    <main className="glass-scene flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-sit.png" alt="Archiaccess SIT" width={40} height={40} />
            <h1 className="text-lg font-medium">Système d'Information Technique</h1>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Accueil
          </Link>
        </div>

        <form onSubmit={search} className="liquid-glass flex items-center gap-2 rounded-2xl p-2">
          <Search size={18} className="ml-2 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Adresse, entreprise, SIREN/SIRET… — tapez ce que vous cherchez"
            className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="chrome-black shrink-0 rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSearching ? "…" : "Rechercher"}
          </button>
        </form>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {addresses.length > 0 && !selectedAddress && (
          <div className="liquid-glass-panel rounded-2xl p-4">
            <h2 className="mb-2 text-xs font-medium text-muted-foreground">Adresses trouvées — sélectionnez-en une</h2>
            <div className="space-y-2">
              {addresses.map((a) => (
                <button
                  key={`${a.citycode}-${a.label}`}
                  onClick={() => selectAddress(a)}
                  className="liquid-glass-soft block w-full rounded-xl p-3 text-left text-sm transition-shadow hover:shadow-md"
                >
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.context}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasTiles && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {selectedAddress && (
              <Tile title="Adresse">
                <p className="font-medium">{selectedAddress.label}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <dt>Code INSEE</dt>
                  <dd>{selectedAddress.citycode}</dd>
                  <dt>Code postal</dt>
                  <dd>{selectedAddress.postcode}</dd>
                  <dt>Coordonnées</dt>
                  <dd>
                    {selectedAddress.coordinates[0].toFixed(5)}, {selectedAddress.coordinates[1].toFixed(5)}
                  </dd>
                  <dt>Score</dt>
                  <dd>{Math.round(selectedAddress.score * 100)}%</dd>
                </dl>
              </Tile>
            )}

            {selectedAddress && (
              <Tile title="Cadastre" loading={parcels === null}>
                {parcels && parcels.length === 0 && <p className="text-xs text-muted-foreground">Aucune parcelle trouvée à proximité.</p>}
                {parcels && parcels.length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {parcels.map((p) => (
                      <li key={p.idu}>
                        Section {p.section}, parcelle {p.numero} — {p.contenanceM2} m² (<span className="font-mono">{p.idu}</span>)
                      </li>
                    ))}
                  </ul>
                )}
              </Tile>
            )}

            {selectedAddress && (
              <Tile title="Urbanisme (PLU/POS)" loading={urbanZones === null}>
                {urbanZones && urbanZones.length === 0 && <p className="text-xs text-muted-foreground">Aucune zone trouvée (document non couvert par le GPU).</p>}
                {urbanZones && urbanZones.length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {urbanZones.map((z, i) => (
                      <li key={i}>
                        {z.description} (<span className="font-mono">{z.label}</span>){z.type && ` — type ${z.type}`}
                      </li>
                    ))}
                  </ul>
                )}
              </Tile>
            )}

            {selectedAddress && (
              <Tile title="Géorisques" loading={risks === null}>
                {risks && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Zone sismique : {risks.seismicZone ?? "non renseignée"} · Potentiel radon : {risks.radonPotential ?? "non renseigné"}
                    </p>
                    {risks.risks.length > 0 ? (
                      <ul className="list-inside list-disc">
                        {risks.risks.map((r) => (
                          <li key={r.code}>{r.label}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Aucun risque répertorié pour cette commune.</p>
                    )}
                  </div>
                )}
              </Tile>
            )}

            {selectedAddress && parcels && parcels.length > 0 && (
              <Tile title={`DVF — section ${parcels[0].sectionPrefixe.slice(3)}`} loading={mutations === null}>
                {mutations && mutations.length === 0 && <p className="text-xs text-muted-foreground">Aucune vente répertoriée dans cette section.</p>}
                {mutations && mutations.length > 0 && (
                  <ul className="custom-scrollbar max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {mutations.slice(0, 10).map((m) => (
                      <li key={m.idMutation}>
                        {m.date} — {m.nature} — {m.adresse}
                        {m.valeurFonciere !== null && ` — ${m.valeurFonciere.toLocaleString("fr-FR")} €`}
                        {m.surfaceReelleBati !== null && ` (${m.surfaceReelleBati} m²)`}
                      </li>
                    ))}
                  </ul>
                )}
              </Tile>
            )}

            {selectedAddress && (
              <Tile title="DPE à proximité" loading={dpeRecords === null}>
                {dpeRecords && dpeRecords.length === 0 && <p className="text-xs text-muted-foreground">Aucun diagnostic répertorié à proximité.</p>}
                {dpeRecords && dpeRecords.length > 0 && (
                  <ul className="custom-scrollbar max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {dpeRecords.map((d) => (
                      <li key={d.numeroDpe}>
                        {d.adresse} — énergie <span className="font-medium">{d.etiquetteEnergie ?? "?"}</span> / GES{" "}
                        <span className="font-medium">{d.etiquetteGes ?? "?"}</span>
                        {d.typeBatiment && ` (${d.typeBatiment}${d.surfaceHabitable ? `, ${d.surfaceHabitable} m²` : ""})`}
                      </li>
                    ))}
                  </ul>
                )}
              </Tile>
            )}

            {companies.map((c) => (
              <Tile key={c.siren} title="Entreprise">
                <p className="font-medium">
                  {c.nom} {c.sigle && <span className="text-xs text-muted-foreground">({c.sigle})</span>}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <dt>SIREN</dt>
                  <dd className="font-mono">{c.siren}</dd>
                  {c.siret && (
                    <>
                      <dt>SIRET (siège)</dt>
                      <dd className="font-mono">{c.siret}</dd>
                    </>
                  )}
                  <dt>Statut</dt>
                  <dd>{c.etatAdministratif ?? "inconnu"}</dd>
                  {c.categorieEntreprise && (
                    <>
                      <dt>Catégorie</dt>
                      <dd>{c.categorieEntreprise}</dd>
                    </>
                  )}
                  {c.activitePrincipale && (
                    <>
                      <dt>Activité (NAF)</dt>
                      <dd>{c.activitePrincipale}</dd>
                    </>
                  )}
                  {c.dateCreation && (
                    <>
                      <dt>Création</dt>
                      <dd>{c.dateCreation}</dd>
                    </>
                  )}
                  {c.adresse && (
                    <>
                      <dt>Adresse (siège)</dt>
                      <dd className="col-span-1">{c.adresse}</dd>
                    </>
                  )}
                  {c.dirigeants.length > 0 && (
                    <>
                      <dt>Dirigeant(s)</dt>
                      <dd>{c.dirigeants.join(", ")}</dd>
                    </>
                  )}
                </dl>
                {(bodaccBySiren[c.siren]?.length ?? 0) > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-2">
                    <h4 className="mb-1 text-xs font-medium text-muted-foreground">BODACC — annonces légales</h4>
                    <ul className="custom-scrollbar max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {bodaccBySiren[c.siren].map((a) => (
                        <li key={a.id}>
                          {a.datePublication} — {a.famille} ({a.type})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Tile>
            ))}
          </div>
        )}

        <DocumentUpload />
      </div>

      <aside className="liquid-glass-panel flex h-[45vh] w-full shrink-0 flex-col p-4 lg:h-screen lg:w-96">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={16} />
          <h2 className="text-sm font-medium">Archiaccess AI</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Résume automatiquement les données chargées et répond à vos questions dessus.
        </p>
        <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto">
          {aiMessages.length === 0 && (
            <p className="text-xs text-muted-foreground">Lancez une recherche pour obtenir un premier résumé.</p>
          )}
          {aiMessages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={
                  m.role === "user"
                    ? "chrome-black inline-block max-w-[90%] rounded-2xl px-3 py-2 text-xs text-white"
                    : "liquid-glass-soft inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs"
                }
              >
                {m.content}
              </span>
            </div>
          ))}
          {isAiSending && (
            <div className="text-left">
              <span className="liquid-glass-soft inline-block rounded-2xl px-3 py-2 text-xs text-muted-foreground">
                Archiaccess AI réfléchit…
              </span>
            </div>
          )}
        </div>
        <form onSubmit={submitAiInput} className="mt-3 flex gap-2">
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Une question sur ces données…"
            className="liquid-glass-inset flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          />
          <button
            type="submit"
            disabled={isAiSending}
            className="chrome-black shrink-0 rounded-xl px-3 py-2 text-white disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send size={14} />
          </button>
        </form>
      </aside>
    </main>
  )
}

function Tile({ title, loading, children }: { title: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="liquid-glass-panel rounded-2xl p-4 text-sm">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      {loading ? <p className="text-xs text-muted-foreground">Recherche…</p> : children}
    </div>
  )
}

function DocumentUpload() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim() || isSaving) return
    setIsSaving(true)
    setFeedback("")
    try {
      const res = await fetch("/api/sit/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType: "etude", content }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedback("Étude indexée — le copilote Archiaccess AI peut s'en servir de contexte.")
        setTitle("")
        setContent("")
      } else {
        setFeedback(`Erreur : ${data.error}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="liquid-glass rounded-3xl p-6">
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">Ajouter une étude (Markdown)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Indexée pour que le copilote Archiaccess AI puisse s'en servir comme contexte (recherche par similarité, pgvector).
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l'étude"
          className="liquid-glass-inset rounded-xl px-3 py-2 text-sm outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Contenu en Markdown…"
          rows={6}
          className="liquid-glass-inset custom-scrollbar rounded-xl px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center justify-between">
          {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="chrome-black ml-auto rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSaving ? "Indexation…" : "Ajouter au SIT"}
          </button>
        </div>
      </form>
    </div>
  )
}
