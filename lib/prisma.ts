import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"
import { getDatabaseUrl } from "@/lib/secrets"

const globalForPrisma = globalThis as unknown as { prismaPromise?: Promise<PrismaClient> }

async function createPrismaClient(): Promise<PrismaClient> {
  const connectionString = await getDatabaseUrl()
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export function getPrisma(): Promise<PrismaClient> {
  if (!globalForPrisma.prismaPromise) {
    globalForPrisma.prismaPromise = createPrismaClient()
  }
  return globalForPrisma.prismaPromise
}
