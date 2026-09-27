#!/usr/bin/env node
// Génère le PDF « Référentiel de méthode Archiaccess — AMO / OPC » à partir
// des données de lib/referentiel (source unique, partagée avec l'espace
// projet du SIT).
//
//   node scripts/referentiel-pdf.mjs [sortie.pdf]
//
// Étapes : transpilation des fichiers TS de lib/referentiel en CommonJS dans
// un dossier temporaire (API typescript, pas de dépendance ajoutée), rendu
// HTML, impression PDF par Chromium sans interface. Chemin de Chromium :
// variable CHROME_PATH, sinon emplacements usuels.

import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import ts from "typescript"

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const sortie = path.resolve(process.argv[2] ?? path.join(racine, "docs/referentiel/Referentiel-Archiaccess-AMO-OPC.pdf"))

// --- Chargement des données ------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "referentiel-"))
const src = path.join(racine, "lib/referentiel")
for (const fichier of fs.readdirSync(src, { recursive: true })) {
  if (!String(fichier).endsWith(".ts")) continue
  const code = fs.readFileSync(path.join(src, fichier), "utf8")
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const cible = path.join(tmp, String(fichier).replace(/\.ts$/, ".js"))
  fs.mkdirSync(path.dirname(cible), { recursive: true })
  fs.writeFileSync(cible, js)
}
const require = createRequire(path.join(tmp, "x.js"))
const { PHASES, REFERENTIEL_VERSION, texteItem, missionsItem } = require("./index.js")
const { PRESENTATION, PRINCIPES, AXES_INTRO } = require("./principes.js")
const { STATUTS_MOA, MONTAGES, TYPOLOGIES, MISSIONS, ACTEURS, STATUTS_VALIDATION } = require("./libelles.js")

// --- Rendu HTML ------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
// Polices et logo embarqués en data URI : Chromium sans interface ne charge
// pas de façon fiable les ressources file:// référencées depuis la page.
const dataUri = (fichier, type) => `data:${type};base64,${fs.readFileSync(path.join(racine, fichier)).toString("base64")}`
const police = (fichier) => `url("${dataUri(`app/fonts/${fichier}`, "font/woff2")}") format("woff2")`

function libelleCondition(c) {
  const parts = []
  if (c.statutMoa) parts.push(c.statutMoa.map((v) => STATUTS_MOA[v]).join(" ; "))
  if (c.montage) parts.push(c.montage.map((v) => MONTAGES[v]).join(" ; "))
  if (c.typologie) parts.push(c.typologie.map((v) => TYPOLOGIES[v]).join(" ; "))
  if (c.mission) parts.push(c.mission.map((v) => MISSIONS[v]).join(" ; "))
  if (c.rehabilitation) parts.push("Réhabilitation ou site occupé")
  return parts.join(" · ") || "Toutes opérations"
}

const liste = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="vide">—</p>`)

function listeItems(items) {
  return `<ul>${items
    .map((i) => {
      const m = missionsItem(i)
      const tag = m ? `<span class="tag">${esc(m.map((x) => MISSIONS[x]).join(" / "))}</span> ` : ""
      return `<li>${tag}${esc(texteItem(i))}</li>`
    })
    .join("")}</ul>`
}

function etapeHtml(e) {
  return `
  <section class="etape">
    <header class="etape-tete">
      <span class="code">${esc(e.code)}</span>
      <h3>${esc(e.titre)}</h3>
      <span class="statut statut-${e.statut}">${esc(STATUTS_VALIDATION[e.statut])}</span>
    </header>
    <p class="objectif">${esc(e.objectif)}</p>
    <h4>Qui fait quoi</h4>
    <table class="roles">${e.roles.map((r) => `<tr><th>${esc(ACTEURS[r.acteur])}</th><td>${esc(r.role)}</td></tr>`).join("")}</table>
    ${e.entrees?.length ? `<h4>Entrées</h4>${liste(e.entrees)}` : ""}
    <h4>Livrables Archiaccess</h4>${listeItems(e.livrables)}
    <div class="deux">
      <div class="bloc outil"><h4>Ce que l'outil prépare</h4>${liste(e.outil)}</div>
      <div class="bloc humain"><h4>Ce que l'ingénieur fait lui-même</h4>${liste(e.humain)}</div>
    </div>
    <h4>Points de vigilance</h4>${liste(e.vigilance)}
    ${
      e.variantes.length
        ? `<h4>Variantes</h4><table class="variantes">${e.variantes
            .map(
              (v) =>
                `<tr><th>${esc(libelleCondition(v.quand))}</th><td>${esc(v.texte)}${v.aPreciser ? ` <span class="a-preciser">À préciser avec un senior</span>` : ""}</td></tr>`,
            )
            .join("")}</table>`
        : ""
    }
    <h4>Textes et formulaires publics</h4>${liste(e.textes)}
  </section>`
}

function phaseHtml(p) {
  if (!p.etapes.length) {
    return `<section class="phase"><h2><span class="num">Phase ${p.numero}</span>${esc(p.titre)}</h2><p class="en-cours">Phase en cours de rédaction.</p></section>`
  }
  return `<section class="phase"><h2><span class="num">Phase ${p.numero}</span>${esc(p.titre)}</h2><p class="intro">${esc(p.intro)}</p>${p.etapes.map(etapeHtml).join("")}</section>`
}

const tableAxe = (titre, valeurs) =>
  `<div class="axe"><h4>${esc(titre)}</h4><ul>${Object.values(valeurs).map((v) => `<li>${esc(v)}</li>`).join("")}</ul></div>`

const nbEtapes = PHASES.reduce((n, p) => n + p.etapes.length, 0)

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Référentiel Archiaccess AMO / OPC</title>
<style>
@font-face { font-family: Inter; font-weight: 300; src: ${police("Inter-300.woff2")}; }
@font-face { font-family: Inter; font-weight: 400; src: ${police("Inter-400.woff2")}; }
@font-face { font-family: Inter; font-weight: 500; src: ${police("Inter-500.woff2")}; }
@font-face { font-family: Inter; font-weight: 900; src: ${police("Inter-900.woff2")}; }
:root {
  --encre: oklch(0.13 0.005 130);
  --fond: oklch(0.94 0.018 135);
  --carte: oklch(0.97 0.012 135);
  --bord: oklch(0.86 0.012 135);
  --gris: oklch(0.48 0.01 130);
}
@page { size: A4; margin: 18mm 16mm 20mm 16mm;
  @bottom-left { content: "Archiaccess — Référentiel AMO / OPC — v${REFERENTIEL_VERSION} — document interne"; font-family: Inter, sans-serif; font-weight: 300; font-size: 7.5pt; color: #6b6f68; }
  @bottom-right { content: counter(page) " / " counter(pages); font-family: Inter, sans-serif; font-weight: 400; font-size: 7.5pt; color: #6b6f68; }
}
@page :first { margin: 0; @bottom-left { content: none } @bottom-right { content: none } }
* { box-sizing: border-box; }
body { font-family: Inter, sans-serif; font-weight: 400; font-size: 9.5pt; line-height: 1.45; color: var(--encre); margin: 0; }
h1, h2, h3, h4 { margin: 0; }
ul { margin: 2pt 0 0; padding-left: 13pt; }
li { margin: 1.5pt 0; }
.couverture { height: 296mm; overflow: hidden; background: var(--encre); color: white; padding: 34mm 22mm; display: flex; flex-direction: column; break-after: page; }
.couverture img { width: 34mm; border-radius: 6mm; }
.couverture .sur { margin-top: 38mm; font-weight: 300; letter-spacing: .28em; text-transform: uppercase; font-size: 9pt; opacity: .7; }
.couverture h1 { font-weight: 900; font-size: 34pt; line-height: 1.05; margin-top: 6mm; letter-spacing: -.01em; }
.couverture .sous { font-weight: 300; font-size: 14pt; margin-top: 6mm; opacity: .85; }
.couverture .pied { margin-top: auto; font-weight: 300; font-size: 9pt; opacity: .7; line-height: 1.7; }
.couverture .avert { border: 1px solid rgba(255,255,255,.35); border-radius: 3mm; padding: 4mm 5mm; font-size: 8.5pt; margin-top: 10mm; font-weight: 300; }
h2 { font-weight: 900; font-size: 19pt; letter-spacing: -.01em; margin-bottom: 4mm; }
h2 .num { display: block; font-weight: 300; font-size: 8.5pt; letter-spacing: .25em; text-transform: uppercase; color: var(--gris); margin-bottom: 1.5mm; }
.chapitre, .phase { break-before: page; }
.intro, .lead { font-size: 10.5pt; font-weight: 300; margin-bottom: 5mm; }
.principe { background: var(--carte); border: 1px solid var(--bord); border-radius: 3mm; padding: 3.5mm 4.5mm; margin-bottom: 3mm; break-inside: avoid; }
.principe h3 { font-size: 10.5pt; font-weight: 500; margin-bottom: 1.5mm; }
.axes { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; }
.axe { background: var(--carte); border: 1px solid var(--bord); border-radius: 3mm; padding: 3.5mm 4mm; }
.axe h4 { font-weight: 500; font-size: 9.5pt; margin-bottom: 1mm; }
table { border-collapse: collapse; width: 100%; }
.sommaire td, .sommaire th { text-align: left; padding: 1mm 2mm; }
.sommaire th { font-weight: 500; width: 20mm; }
.sommaire tr.ph th, .sommaire tr.ph td { font-weight: 900; padding-top: 3.2mm; border-bottom: 1px solid var(--encre); }
.sommaire tr.et th { font-weight: 400; color: var(--gris); }
.sommaire tr { break-inside: avoid; }
.etape { margin-top: 7mm; padding-top: 4mm; border-top: 2px solid var(--encre); }
.etape-tete { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 2mm; break-after: avoid; }
.etape-tete .code { font-weight: 900; font-size: 13pt; }
.etape-tete h3 { font-weight: 500; font-size: 13pt; flex: 1; }
.statut { font-size: 7pt; text-transform: uppercase; letter-spacing: .12em; border: 1px solid var(--encre); border-radius: 10pt; padding: .5mm 2.5mm; white-space: nowrap; }
.statut-brouillon { color: var(--gris); border-color: var(--bord); }
.statut-valide { background: var(--encre); color: white; }
.objectif { background: var(--fond); border-radius: 2.5mm; padding: 3mm 4mm; font-weight: 500; margin: 0 0 1mm; }
h4 { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .14em; font-weight: 500; color: var(--gris); margin: 4mm 0 1mm; break-after: avoid; }
.roles th, .variantes th { text-align: left; vertical-align: top; font-weight: 500; width: 42mm; padding: 1.4mm 3mm 1.4mm 0; }
.roles td, .variantes td { padding: 1.4mm 0; vertical-align: top; }
.roles tr, .variantes tr { border-bottom: 1px solid var(--bord); break-inside: avoid; }
.variantes th { width: 58mm; }
.deux { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 2mm; break-inside: avoid; }
.bloc { border-radius: 3mm; padding: 1mm 4mm 3mm; }
.bloc.outil { border: 1px dashed var(--gris); }
.bloc.humain { background: var(--encre); color: white; }
.bloc.humain h4 { color: rgba(255,255,255,.7); }
.tag { font-size: 7pt; border: 1px solid var(--bord); border-radius: 8pt; padding: 0 1.8mm; color: var(--gris); white-space: nowrap; }
.a-preciser { font-size: 7pt; text-transform: uppercase; letter-spacing: .08em; border: 1px solid var(--encre); border-radius: 8pt; padding: 0 1.8mm; white-space: nowrap; }
.en-cours, .vide { color: var(--gris); font-weight: 300; }
.legende { font-size: 8.5pt; color: var(--gris); margin-top: 4mm; }
</style></head><body>

<section class="couverture">
  <img src="${dataUri("public/logo-sit.png", "image/png")}" alt="">
  <div class="sur">Archiaccess — méthode interne</div>
  <h1>Référentiel de méthode<br>AMO / OPC</h1>
  <div class="sous">Documentation et process du cabinet</div>
  <div class="avert">Version ${REFERENTIEL_VERSION} — document de travail. Les étapes marquées « Brouillon » n'ont pas encore été relues par un senior du cabinet et ne constituent pas une doctrine validée.</div>
  <div class="pied">Édition du ${esc(date)}<br>${nbEtapes} étapes rédigées sur ${PHASES.length} phases<br>Usage interne Archiaccess</div>
</section>

<section class="chapitre">
  <h2><span class="num">Avant-propos</span>Présentation et principes</h2>
  <p class="lead">${esc(PRESENTATION)}</p>
  ${PRINCIPES.map((p) => `<div class="principe"><h3>${esc(p.titre)}</h3><p>${esc(p.texte)}</p></div>`).join("")}
</section>

<section class="chapitre">
  <h2><span class="num">Cadrage d'une opération</span>Les trois axes de variation</h2>
  <p class="lead">${esc(AXES_INTRO)}</p>
  <div class="axes">
    ${tableAxe("Statut du maître d'ouvrage", STATUTS_MOA)}
    ${tableAxe("Montage contractuel", MONTAGES)}
    ${tableAxe("Typologie d'ouvrage", TYPOLOGIES)}
  </div>
  <p class="legende">La mission confiée à Archiaccess (${Object.values(MISSIONS).join(", ").toLowerCase()}) et le caractère de réhabilitation ou de site occupé complètent le profil de l'opération.</p>

</section>

<section class="chapitre">
  <h2><span class="num">Vue d'ensemble</span>Table des phases et des étapes</h2>
  <table class="sommaire">
    ${PHASES.map(
      (p) =>
        `<tr class="ph"><th>Phase ${p.numero}</th><td>${esc(p.titre)}</td></tr>` +
        p.etapes.map((e) => `<tr class="et"><th>${esc(e.code)}</th><td>${esc(e.titre)}</td></tr>`).join(""),
    ).join("")}
  </table>
  <p class="legende">Chaque étape suit le même gabarit : objectif, qui fait quoi, entrées, livrables Archiaccess, ce que l'outil prépare, ce que l'ingénieur fait lui-même, points de vigilance, variantes selon le profil de l'opération, textes et formulaires publics, statut de validation.</p>
</section>

${PHASES.map(phaseHtml).join("")}
</body></html>`

// --- Impression -------------------------------------------------------------

const fichierHtml = path.join(tmp, "referentiel.html")
fs.writeFileSync(fichierHtml, html)

const candidats = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].filter(Boolean)
const chrome = candidats.find((c) => fs.existsSync(c))
if (!chrome) throw new Error(`Chromium introuvable (essayés : ${candidats.join(", ")}). Renseigner CHROME_PATH.`)

fs.mkdirSync(path.dirname(sortie), { recursive: true })
execFileSync(chrome, [
  "--headless",
  "--no-sandbox",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${sortie}`,
  `file://${fichierHtml}`,
], { stdio: ["ignore", "ignore", "pipe"] })

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`PDF écrit : ${path.relative(racine, sortie)} (${(fs.statSync(sortie).size / 1024).toFixed(0)} Ko)`)
