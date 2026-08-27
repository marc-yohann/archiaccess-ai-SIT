// Stockage des documents du SIT (études en Markdown, voir CLAUDE.md) sur
// S3 — bucket provisionné en eu-west-3, accès public bloqué, chiffré par
// défaut (voir CLAUDE.md pour le détail du provisioning). Le nom du
// bucket n'est pas un secret (il n'accorde aucun accès en lui-même, le
// rôle IAM applicatif le fait) donc pas besoin de passer par Secrets
// Manager pour ça.

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const REGION = "eu-west-3"
const BUCKET = "archiaccess-ai-sit-documents-638954279923"

const client = new S3Client({ region: REGION })

export async function putDocument(key: string, content: string): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: content,
      ContentType: "text/markdown; charset=utf-8",
    }),
  )
}

export async function getDocument(key: string): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const body = await res.Body?.transformToString()
  if (body === undefined) throw new Error(`Document ${key} introuvable dans le bucket.`)
  return body
}

export async function deleteDocument(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
