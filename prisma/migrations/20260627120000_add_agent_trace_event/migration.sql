-- CreateTable
CREATE TABLE "public"."AgentTraceEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL,
    "agentClass" TEXT,
    "icon" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "evidence" JSONB,
    "emittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTraceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentTraceEvent_sessionId_idx" ON "public"."AgentTraceEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AgentTraceEvent_tenantId_kind_createdAt_idx" ON "public"."AgentTraceEvent"("tenantId", "kind", "createdAt");
