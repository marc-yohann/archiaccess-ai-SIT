-- Audit du 2026-10-03 : limitation des tentatives de connexion.
-- Une ligne par échec de connexion (adresse saisie, adresse IP), comptée
-- sur une fenêtre glissante par la route /api/auth/login, effacée après
-- une connexion réussie et au-delà de 24 heures. Partagée par toutes les
-- instances de la fonction serveur, contrairement à un compteur en mémoire.

-- CreateTable
CREATE TABLE "TentativeConnexion" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeConnexion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TentativeConnexion_email_createdAt_idx" ON "TentativeConnexion"("email", "createdAt");

-- CreateIndex
CREATE INDEX "TentativeConnexion_ip_createdAt_idx" ON "TentativeConnexion"("ip", "createdAt");
