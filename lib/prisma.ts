import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"
import { getDatabaseUrl } from "@/lib/secrets"

const globalForPrisma = globalThis as unknown as { prismaPromise?: Promise<PrismaClient> }

// Connexions par instance de la fonction serveur (audit du 2026-10-03) :
// la base est une petite instance (db.t4g.micro) et chaque instance Lambda
// a son propre pool. 5 suffit (les requêtes d'une même page en parallèle
// attendent leur tour) et évite de saturer la base en cas d'affluence.
const CONNEXIONS_PAR_INSTANCE = 5

async function createPrismaClient(): Promise<PrismaClient> {
  const connectionString = await getDatabaseUrl()
  const adapter = new PrismaPg({ connectionString, max: CONNEXIONS_PAR_INSTANCE })
  return new PrismaClient({ adapter })
}

export function getPrisma(): Promise<PrismaClient> {
  if (!globalForPrisma.prismaPromise) {
    const promesse = createPrismaClient()
    // Un échec (lecture du secret momentanément impossible) n'est pas
    // gardé : la requête suivante réessaie, au lieu que l'instance reste
    // en panne jusqu'à son redémarrage.
    promesse.catch(() => {
      if (globalForPrisma.prismaPromise === promesse) globalForPrisma.prismaPromise = undefined
    })
    globalForPrisma.prismaPromise = promesse
  }
  return globalForPrisma.prismaPromise
}
