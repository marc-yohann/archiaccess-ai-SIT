-- "Coffre" du SIT : mémoire permanente des données externes déjà
-- récupérées (cadastre, DVF, entreprises, urbanisme, DPE, BODACC,
-- Géorisques, adresse) — voir CLAUDE.md.

-- CreateTable
CREATE TABLE "DataCacheEntry" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataCacheEntry_source_idx" ON "DataCacheEntry"("source");

-- CreateIndex
CREATE UNIQUE INDEX "DataCacheEntry_source_cacheKey_key" ON "DataCacheEntry"("source", "cacheKey");
