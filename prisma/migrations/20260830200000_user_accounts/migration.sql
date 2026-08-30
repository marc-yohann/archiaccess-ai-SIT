-- Remplace le mot de passe d'équipe partagé par des comptes employés
-- individuels (voir CLAUDE.md, décision utilisateur du 2026-08-30).
-- Les données existantes de Session/Conversation/Message ne sont que du
-- trafic de test de cette phase de développement (pas de vrai usage
-- employé) : purgées plutôt que migrées, aucune n'a de userId valide vers
-- lequel les rattacher.

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_sessionId_fkey";

-- Purge des données de test (voir note ci-dessus)
TRUNCATE TABLE "Message", "Conversation", "Session" CASCADE;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable: Session, sessionId (token) reste la clé primaire, on ajoute userId
ALTER TABLE "Session" ADD COLUMN "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Conversation, sessionId -> userId
ALTER TABLE "Conversation" DROP COLUMN "sessionId";
ALTER TABLE "Conversation" ADD COLUMN "userId" TEXT NOT NULL;

-- DropIndex
DROP INDEX "Conversation_sessionId_idx";

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
