# Scientist Sponsor Marketplace

This module contains the scientist and sponsor collaboration surface for discovery sharing, diligence, deal-room workflows, and approval governance.

## Structure

- `backend/`: controllers, services, workflows, permissions, integrations
- `frontend/`: page composition, dashboards, hooks, shared UI
- `shared/`: role constants, schemas, types, shared helpers

## Authorization And Audit Coverage

The marketplace is covered at three levels so role assumptions, record visibility, workflow permissions, and workspace audit filtering stay aligned.

| Layer | Scope | Primary files |
|---|---|---|
| Authz unit tests | Role assumability, anti-escalation, owner vs non-owner access, sponsor public discovery reads, deal-room membership checks | `__tests__/scientist-sponsor-marketplace-authz.test.ts` |
| Mocked route tests | Item, collection, workflow, and workspace route behavior including `401` and `403` branches | `__tests__/scientist-sponsor-marketplace-routes.test.ts`, `__tests__/scientist-sponsor-marketplace-collections-routes.test.ts`, `__tests__/scientist-sponsor-marketplace-workspace-route.test.ts` |
| Live integration tests | Real JWT-backed API requests against seeded SQLite data for discovery, diligence, deal-room, approval, and audit visibility flows | `__tests__/scientist-sponsor-marketplace-integration.test.ts` |

## Covered Matrix

- Role assumption is constrained by global role and shared UI/server helpers so members cannot escalate to reviewer or admin capabilities.
- Discovery and entity access enforce owner visibility, sponsor public-read behavior, and record-level authorization.
- Deal-room mutations require membership for `message`, `fund`, `negotiate`, and `buildAgreement`.
- Sponsor transitions cover `requestMoreInfo` and `enterDealRoom`, including outsider `403` regressions.
- Agreement approval is limited to reviewer and admin actors, with explicit denial coverage for member escalation attempts.
- Audit logging is asserted for privileged approval events so approval authorization and persistence are tested together.
- Workspace snapshots enforce audit visibility rules:
  - reviewer and admin workspaces see recent audits across the module
  - non-privileged actors see only their own audits or audits tied to deal rooms they can access
  - unrelated privileged approval rows stay hidden from outsiders
  - related privileged approval rows remain visible to members who belong to the affected deal room

## Key Runtime Paths

- Workspace snapshot route: `app/api/scientist-sponsor-marketplace/workspace/route.ts`
- Generic entity routes: `app/api/scientist-sponsor-marketplace/[entity]/route.ts`, `app/api/scientist-sponsor-marketplace/[entity]/[id]/route.ts`
- Workflow route: `app/api/scientist-sponsor-marketplace/workflows/[workflow]/route.ts`
- Workspace aggregation logic: `backend/services/workspaceService.ts`
- Access control: `backend/permissions/access-control.ts`
- Identity and role assumption: `backend/integrations/identityIntegration.ts`, `shared/utils/index.ts`