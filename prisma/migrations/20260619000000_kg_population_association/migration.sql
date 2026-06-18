-- Add POPULATION_ASSOCIATION to KgEdgeType.
-- This edge type is written by the flywheel causal-edge materializer to project
-- de-identified, k-anonymised AggregateOutcome rows into the knowledge graph as
-- population real-world-evidence (RWE) associations.
--
-- IMPORTANT: this is an ASSOCIATION, not a mechanism. RWE edges are capped at
-- low evidence grades (C_LOW / D_VERY_LOW) and must never be presented as a
-- validated mechanistic or clinical claim.

ALTER TYPE "public"."KgEdgeType" ADD VALUE IF NOT EXISTS 'POPULATION_ASSOCIATION';
