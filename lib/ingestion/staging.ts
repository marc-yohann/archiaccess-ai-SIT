// Zone de "staging" S3 pour les fichiers bulk téléchargés par le moteur
// d'ingestion — voir CLAUDE.md : réutilise le même bucket documents que
// lib/storage.ts (S3 déjà provisionné, pas de nouveau bucket). Un fichier
// bulk volumineux (ex: le stock SIRENE, 2,8 Go) est téléchargé par
// morceaux bornés (une invocation = un morceau, voir lib/ingestion/
// sources/sirene.ts) : chaque morceau devient son propre objet S3
// (part-00000.bin, part-00001.bin...) plutôt qu'un upload multipart —
// plus simple à reprendre après interruption (pas d'état d'upload
// multipart à suivre), et le traitement peut relire les morceaux dans
// l'ordre comme un flux continu.
//
// LOCAL_DIAG_STAGING_DIR : bypass de diagnostic (même principe que
// LOCAL_DIAG_DATABASE_URL dans lib/prisma.ts) — redirige vers le
// filesystem local pour valider le mécanisme sans identifiants AWS
// réels. Retiré avant tout commit (voir historique Phase 1/2).

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { Readable } from "node:stream"

const REGION = "eu-west-3"
const BUCKET = "archiaccess-ai-sit-documents-638954279923"

const client = new S3Client({ region: REGION })

function stagingKey(source: string, dataset: string, version: string, partIndex: number): string {
  return `staging/${source}/${dataset}/${version}/part-${String(partIndex).padStart(6, "0")}.bin`
}

// Exposée pour que les appelants (ex: lib/ingestion/chunked-zip.ts)
// stockent la vraie clé produite (DatasetChunk.s3Key) plutôt que de la
// recalculer indépendamment et risquer une divergence.
export function stagingKeyFor(source: string, dataset: string, version: string, partIndex: number): string {
  return stagingKey(source, dataset, version, partIndex)
}

function localPath(key: string): string {
  const dir = process.env.LOCAL_DIAG_STAGING_DIR as string
  return join(dir, key)
}

export async function writeStagingPart(source: string, dataset: string, version: string, partIndex: number, body: Buffer): Promise<void> {
  const key = stagingKey(source, dataset, version, partIndex)

  if (process.env.LOCAL_DIAG_STAGING_DIR) {
    const path = localPath(key)
    mkdirSync(dirname(path), { recursive: true })
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(path)
      ws.on("error", reject)
      ws.on("finish", resolve)
      ws.end(body)
    })
    return
  }

  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body }))
}

export async function stagingPartExists(source: string, dataset: string, version: string, partIndex: number): Promise<boolean> {
  const key = stagingKey(source, dataset, version, partIndex)

  if (process.env.LOCAL_DIAG_STAGING_DIR) {
    return existsSync(localPath(key))
  }

  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// Lecture d'UN seul morceau (pas une concaténation) — utilisé pour relire
// un chunk précis lors de l'ingestion (par opposition à
// readStagingStream ci-dessous, qui concatène tout pour la décompression
// initiale du fichier original).
export async function readStagingPart(source: string, dataset: string, version: string, partIndex: number): Promise<Buffer> {
  const key = stagingKey(source, dataset, version, partIndex)

  if (process.env.LOCAL_DIAG_STAGING_DIR) {
    const path = localPath(key)
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const rs = createReadStream(path)
      rs.on("data", (c) => chunks.push(c as Buffer))
      rs.on("end", () => resolve(Buffer.concat(chunks)))
      rs.on("error", reject)
    })
  }

  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const body = await res.Body?.transformToByteArray()
  return body ? Buffer.from(body) : Buffer.alloc(0)
}

// Flux continu de lecture des morceaux 0..partCount-1, dans l'ordre —
// c'est ce que le parseur ZIP/CSV consomme comme s'il lisait le fichier
// bulk original en une seule fois.
export function readStagingStream(source: string, dataset: string, version: string, partCount: number): Readable {
  let currentPart = 0

  return new Readable({
    read() {
      if (currentPart >= partCount) {
        this.push(null)
        return
      }
      const key = stagingKey(source, dataset, version, currentPart)
      currentPart += 1

      if (process.env.LOCAL_DIAG_STAGING_DIR) {
        const path = localPath(key)
        const chunks: Buffer[] = []
        const rs = createReadStream(path)
        rs.on("data", (c) => chunks.push(c as Buffer))
        rs.on("end", () => this.push(Buffer.concat(chunks)))
        rs.on("error", (err) => this.destroy(err))
        return
      }

      client
        .send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
        .then(async (res) => {
          const body = await res.Body?.transformToByteArray()
          this.push(body ? Buffer.from(body) : Buffer.alloc(0))
        })
        .catch((err) => this.destroy(err))
    },
  })
}

// Taille d'un fichier de référence, utilisée pour connaître le
// Content-Length total avant de commencer le téléchargement par
// morceaux (voir lib/ingestion/sources/sirene.ts) — ne concerne pas le
// staging lui-même, juste co-localisé ici pour rester avec les autres
// utilitaires fichiers.
export function localStagingSizeForTest(source: string, dataset: string, version: string, partIndex: number): number | null {
  if (!process.env.LOCAL_DIAG_STAGING_DIR) return null
  const path = localPath(stagingKey(source, dataset, version, partIndex))
  return existsSync(path) ? statSync(path).size : null
}
