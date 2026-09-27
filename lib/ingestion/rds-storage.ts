// Garde-fou stockage RDS de la campagne BOAMP nationale — source de
// vérité : la métrique CloudWatch AWS/RDS FreeStorageSpace, jamais
// pg_database_size(). Mesuré le 2026-09-26 : pg_database_size() ne voyait
// que 1,17 GiB utilisés quand le volume en consommait 4,10 (WAL, journaux,
// bases système invisibles depuis Postgres) — un garde-fou basé dessus
// peut laisser saturer le disque.
//
// Aucun import Prisma ici, volontairement : la décision de stockage ne
// peut pas retomber, même par accident, sur une mesure faite en base. Si
// CloudWatch ne répond pas, le statut est STORAGE_CHECK_UNAVAILABLE et
// l'appelant NE LANCE RIEN : une pause temporaire plutôt qu'un risque de
// saturation.

import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch"

export type StorageStatus = "OK" | "STORAGE_LOW" | "STORAGE_CHECK_UNAVAILABLE"

export const STORAGE_SOURCE = "CloudWatch AWS/RDS FreeStorageSpace (Minimum, période 60 s)"

const GIB = 1024 ** 3

// RDS publie FreeStorageSpace toutes les 60 s (surveillance de base).
// Fenêtre de lecture : les 15 dernières minutes, on retient le point le
// plus RÉCENT (statistique Minimum sur sa minute, donc la valeur la plus
// basse observée pendant cette minute). Un dernier point plus vieux que
// la fenêtre = mesure indisponible, jamais une valeur périmée réutilisée.
const PERIOD_SECONDS = 60
const LOOKBACK_MS = 15 * 60_000

export interface FreeStorageReading {
  freeBytes: number
  measuredAt: Date
}

export interface StorageCheck {
  status: StorageStatus
  freeGiB: number | null
  thresholdGiB: number
  measuredAt: string | null
  source: string
  error: string | null
}

// Décision pure (testable sans AWS) : égalité = STORAGE_LOW, jamais OK.
export function evaluateStorage(reading: FreeStorageReading | null, thresholdGiB: number, error: string | null = null): StorageCheck {
  if (!reading) {
    return { status: "STORAGE_CHECK_UNAVAILABLE", freeGiB: null, thresholdGiB, measuredAt: null, source: STORAGE_SOURCE, error: error ?? "aucune mesure CloudWatch disponible" }
  }
  const freeGiB = reading.freeBytes / GIB
  const status: StorageStatus = reading.freeBytes <= thresholdGiB * GIB ? "STORAGE_LOW" : "OK"
  return { status, freeGiB, thresholdGiB, measuredAt: reading.measuredAt.toISOString(), source: STORAGE_SOURCE, error: null }
}

// Seuil en GiB d'espace RÉELLEMENT libre sur le volume RDS, relu à chaque
// appel (modifiable sans redéploiement). Valeur invalide ou absente : le
// repli fourni par l'appelant (colonne BoampNationalCampaign.minFreeStorageGb).
export function storageThresholdGiB(fallback: number): number {
  const raw = process.env.BOAMP_MIN_FREE_STORAGE_GB
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function rdsInstanceIdentifier(): string {
  return process.env.RDS_INSTANCE_IDENTIFIER || "archiaccess-ai-sit-db"
}

const client = new CloudWatchClient({})

export async function readRdsFreeStorage(): Promise<FreeStorageReading | null> {
  const now = new Date()
  const response = await client.send(
    new GetMetricStatisticsCommand({
      Namespace: "AWS/RDS",
      MetricName: "FreeStorageSpace",
      Dimensions: [{ Name: "DBInstanceIdentifier", Value: rdsInstanceIdentifier() }],
      StartTime: new Date(now.getTime() - LOOKBACK_MS),
      EndTime: now,
      Period: PERIOD_SECONDS,
      Statistics: ["Minimum"],
    }),
  )
  const latest = (response.Datapoints ?? [])
    .filter((d) => d.Timestamp && typeof d.Minimum === "number")
    .sort((a, b) => b.Timestamp!.getTime() - a.Timestamp!.getTime())[0]
  return latest ? { freeBytes: latest.Minimum!, measuredAt: latest.Timestamp! } : null
}

// Mesure + décision. Ne lève jamais : toute erreur CloudWatch (réseau,
// permission IAM, throttling) devient STORAGE_CHECK_UNAVAILABLE, journalisée.
export async function checkRdsStorage(thresholdGiB: number, read: () => Promise<FreeStorageReading | null> = readRdsFreeStorage): Promise<StorageCheck> {
  try {
    const reading = await read()
    const check = evaluateStorage(reading, thresholdGiB)
    if (check.status !== "OK") console.warn(`[storage-guard] ${check.status} free=${check.freeGiB?.toFixed(2) ?? "?"}GiB threshold=${thresholdGiB}GiB error=${check.error ?? "-"}`)
    return check
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : "erreur inconnue"
    console.error(`[storage-guard] STORAGE_CHECK_UNAVAILABLE ${message}`)
    return evaluateStorage(null, thresholdGiB, message)
  }
}
