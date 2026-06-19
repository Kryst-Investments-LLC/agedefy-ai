-- Tier 5.1: Per-user pharmacokinetic profile table
CREATE TABLE "UserPkProfile" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "userId"               TEXT NOT NULL,
    "tenantId"             TEXT NOT NULL DEFAULT 'default',
    "compoundId"           TEXT NOT NULL,
    "vd"                   REAL NOT NULL,
    "cl"                   REAL NOT NULL,
    "ka"                   REAL NOT NULL,
    "f"                    REAL NOT NULL DEFAULT 0.7,
    "n"                    INTEGER NOT NULL,
    "rmse"                 REAL NOT NULL,
    "fittedAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fittedFromOutcomeIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            DATETIME NOT NULL,
    CONSTRAINT "UserPkProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserPkProfile_userId_compoundId_key"
    ON "UserPkProfile" ("userId", "compoundId");
CREATE INDEX "UserPkProfile_userId_idx"
    ON "UserPkProfile" ("userId");
CREATE INDEX "UserPkProfile_compoundId_idx"
    ON "UserPkProfile" ("compoundId");

-- Tier 5.3: Extended prediction logging columns on TwinSimulationRun
ALTER TABLE "TwinSimulationRun" ADD COLUMN "predictionWindowDays"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TwinSimulationRun" ADD COLUMN "predictionExpiresAt"   DATETIME;
ALTER TABLE "TwinSimulationRun" ADD COLUMN "pkParamsUsedJson"      TEXT;
ALTER TABLE "TwinSimulationRun" ADD COLUMN "outcomeTrajectoryJson" TEXT;
ALTER TABLE "TwinSimulationRun" ADD COLUMN "twinAccuracyScore"     REAL;

CREATE INDEX "TwinSimulationRun_predictionExpiresAt_twinAccuracyScore_idx"
    ON "TwinSimulationRun" ("predictionExpiresAt", "twinAccuracyScore");
