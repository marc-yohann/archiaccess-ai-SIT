// Lit les secrets applicatifs depuis AWS Secrets Manager au runtime — même
// principe que archiaccess-pro/lib/secrets.ts : les variables d'environnement
// Amplify n'atteignent pas forcément le compute SSR selon la plateforme
// d'hébergement retenue, donc on ne s'y fie pas. Rôle IAM dédié à ce
// projet, distinct de celui d'archiaccess-pro (voir CLAUDE.md).

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

const DATABASE_SECRET_NAME = "archiaccess-ai-sit/database"
const MISTRAL_SECRET_NAME = "archiaccess-ai-sit/mistral"

const client = new SecretsManagerClient({})
const cache = new Map<string, Promise<string>>()

async function getSecretString(secretId: string): Promise<string> {
  const cached = cache.get(secretId)
  if (cached) return cached

  const promise = client.send(new GetSecretValueCommand({ SecretId: secretId })).then((response) => {
    if (!response.SecretString) throw new Error(`Secret ${secretId} n'a pas de SecretString`)
    return response.SecretString
  })
  // Ne met pas en cache un échec : une erreur transitoire (permissions pas
  // encore propagées, etc.) ne doit pas rester rejouée indéfiniment.
  promise.catch(() => cache.delete(secretId))

  cache.set(secretId, promise)
  return promise
}

export async function getDatabaseUrl(): Promise<string> {
  const raw = await getSecretString(DATABASE_SECRET_NAME)
  const { username, password, host, port, dbname } = JSON.parse(raw) as {
    username: string
    password: string
    host: string
    port: number
    dbname: string
  }
  // RDS impose SSL par défaut (rds.force_ssl=1 sur les instances récentes) ;
  // psql l'utilise silencieusement (sslmode=prefer par défaut, sans
  // vérifier le certificat), mais le driver pg le refuse sans configuration
  // explicite : sslmode=require seul échoue avec "self-signed certificate
  // in certificate chain" (le certificat RDS n'est pas dans le magasin de
  // confiance par défaut de Node) — uselibpqcompat=true retrouve le
  // comportement libpq/psql (chiffré, sans vérification stricte du CA).
  // Constaté en conditions réelles, voir CLAUDE.md.
  return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}?sslmode=require&uselibpqcompat=true`
}

export async function getMistralApiKey(): Promise<string> {
  return getSecretString(MISTRAL_SECRET_NAME)
}
