import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import type { AddressResult } from "@/lib/data-sources/ban"
import type { Parcel } from "@/lib/data-sources/cadastre"
import type { DpeRecord } from "@/lib/data-sources/dpe"

// Persiste dans le référentiel territorial (Site/Parcelle/Bâtiment,
// Phase 1 — voir prisma/schema.prisma) ce que selectAddress() vient de
// récupérer en direct auprès de BAN/cadastre/DPE (app/sit/page.tsx).
// N'introduit aucune nouvelle donnée : structure et relie ce qui est
// déjà réellement récupéré par ces 3 connecteurs. Appelée en tâche de
// fond après une sélection d'adresse — un échec ici ne doit jamais faire
// échouer la recherche elle-même (voir catch côté appelant).
export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { address, parcels, dpeRecords } = (await request.json()) as {
    address: AddressResult
    parcels: Parcel[]
    dpeRecords: DpeRecord[]
  }
  if (!address?.label || !address.citycode) {
    return NextResponse.json({ success: false, error: "Adresse manquante." }, { status: 400 })
  }

  const prisma = await getPrisma()

  const site = await prisma.site.upsert({
    where: { citycode_label: { citycode: address.citycode, label: address.label } },
    create: {
      label: address.label,
      citycode: address.citycode,
      postcode: address.postcode,
      city: address.city,
      longitude: address.coordinates[0],
      latitude: address.coordinates[1],
    },
    update: {
      postcode: address.postcode,
      city: address.city,
      longitude: address.coordinates[0],
      latitude: address.coordinates[1],
    },
  })

  // geom (PostGIS, colonne additive Phase 3) — Unsupported() côté Prisma,
  // mise à jour par SQL brut juste après l'upsert normal.
  await prisma.$executeRaw`UPDATE "Site" SET "geom" = ST_SetSRID(ST_MakePoint(${address.coordinates[0]}, ${address.coordinates[1]}), 4326) WHERE "id" = ${site.id}`

  const sourcesFetched = new Set<string>(["ban"])

  for (const p of parcels ?? []) {
    await prisma.parcelle.upsert({
      where: { idu: p.idu },
      create: {
        siteId: site.id,
        idu: p.idu,
        section: p.section,
        sectionPrefixe: p.sectionPrefixe,
        numero: p.numero,
        contenanceM2: p.contenanceM2,
        codeInsee: p.codeInsee,
        commune: p.commune,
        geometry: p.geometry as object,
      },
      // Une parcelle peut en théorie être recadrée par le cadastre entre
      // deux recherches — on rafraîchit la géométrie/surface plutôt que
      // de garder une valeur périmée.
      update: {
        section: p.section,
        sectionPrefixe: p.sectionPrefixe,
        numero: p.numero,
        contenanceM2: p.contenanceM2,
        geometry: p.geometry as object,
      },
    })
    // geom (PostGIS, colonne additive Phase 3) — backfillée depuis la
    // géométrie GeoJSON réelle déjà stockée dans "geometry", jamais une
    // valeur indépendante.
    await prisma.$executeRaw`UPDATE "Parcelle" SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(p.geometry)}), 4326)) WHERE "idu" = ${p.idu}`
    sourcesFetched.add("cadastre")
  }

  for (const d of dpeRecords ?? []) {
    await prisma.batiment.upsert({
      where: { numeroDpe: d.numeroDpe },
      create: {
        siteId: site.id,
        numeroDpe: d.numeroDpe,
        typeBatiment: d.typeBatiment,
        surfaceHabitable: d.surfaceHabitable,
        etiquetteEnergie: d.etiquetteEnergie,
        etiquetteGes: d.etiquetteGes,
      },
      update: {
        typeBatiment: d.typeBatiment,
        surfaceHabitable: d.surfaceHabitable,
        etiquetteEnergie: d.etiquetteEnergie,
        etiquetteGes: d.etiquetteGes,
      },
    })
    sourcesFetched.add("dpe")
  }

  await Promise.all(
    Array.from(sourcesFetched).map((source) =>
      prisma.siteSource.upsert({
        where: { siteId_source: { siteId: site.id, source } },
        create: { siteId: site.id, source },
        update: { fetchedAt: new Date() },
      }),
    ),
  )

  return NextResponse.json({ success: true, siteId: site.id })
}
