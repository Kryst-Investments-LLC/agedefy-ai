# AgeDefy AI

**Enterprise longevity-medicine platform** — track biomarkers, optimize protocols, access telemedicine, shop curated supplements, and explore anti-aging research in one place.

Built with **Next.js 15** (App Router), **React 19**, **Prisma 6**, **Stripe**, and **NextAuth**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Authentication & Roles](#authentication--roles)
- [API Routes](#api-routes)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Linting & Type-checking](#linting--type-checking)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

---

## Features

| Module | Description |
|---|---|
| **User Dashboard** | Biomarker stats, active protocols, lab orders, pathway progress, subscription status, AI Health Coach |
| **Biomarker Tracking** | Record entries, view trends via Recharts, set targets |
| **Protocol Engine** | Create / fork / publish protocols with compound stacks. Templates library |
| **Knowledge Graph** | Compounds → pathways → interactions → clinical effects |
| **Compound Mixer** | Explore compounds, link interactions, visualize stacks |
| **Lab Testing** | Browse panels, place orders, COA tracking |
| **Telemedicine** | Provider directory, consultation requests (initial / follow-up / lab review / protocol review), cancel flow |
| **Marketplace** | Supplements, peptides, test kits, devices — category filter, order & cancel |
| **Community Forum** | Posts by category (Compounds, Biomarkers, Protocols, Research, General), edit, delete, moderation |
| **Learning Center** | Articles by topic, full CRUD with slug-based routing |
| **Clinical Trials** | External search integration, saved trials |
| **Research Hub** | Paper ingestion, clinical-trial search, research feed |
| **AI Personalization** | Multi-provider AI (OpenAI, Anthropic, Grok), personalized recommendations |
| **Global Search** | Unified search across pathways, compounds, articles, lab panels |
| **Stripe Billing** | 3-tier plans (Starter / Pro / Enterprise), checkout, webhook sync, customer portal |
| **Admin Console** | Platform stats, user management, role assignment, community moderation, review queue, audit log export |
| **Email Service** | Verification emails, password reset, SMTP via Nodemailer |
| **Governance** | Audit logging, review items, clinician task queue |
| **i18n** | 10-locale scaffolding, language switcher, en + es translations |
| **Theming** | Dark/light/system with next-themes |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.2.4 (App Router, Server Components) |
| UI | React 19, Tailwind CSS 3.4, Radix UI, shadcn/ui |
| State | React hooks, server actions |
| Database | Prisma 6.16.2 + SQLite (swap to Postgres for prod) |
| Auth | NextAuth 4.24 (JWT, credentials provider) |
| Payments | Stripe SDK 20.4 |
| Charts | Recharts |
| Email | Nodemailer 8 |
| Validation | Zod 3.24 |
| Testing | Vitest 4.1 |
| CI | GitHub Actions (lint → typecheck → test → build) |
| 3D | Three.js 0.177 |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** (recommended) or npm

### Install & Run

```bash
# Clone
git clone <repo-url> && cd agedefy-ai

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# → Edit .env with your keys (see below)

# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push

# Seed demo data (pathways, compounds, lab panels, providers, products)
pnpm db:seed

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma connection string (`file:./prisma/dev.db` for SQLite) |
| `NEXTAUTH_URL` | Yes | App base URL (`http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | Random 32+ char secret for JWT signing |
| `ENABLE_TEST_AUTH_ENDPOINT` | No | Set to `true` only in controlled test environments to enable the dev/test-only `/api/auth/jwt-for-tests` endpoint for external test automation |
| `ADMIN_EMAILS` | No | Comma-separated emails auto-promoted to ADMIN role |
| `STRIPE_SECRET_KEY` | No | Stripe API key for billing |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook endpoint secret |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | No | Anthropic API key |
| `GROK_API_KEY` | No | Grok API key |
| `SMTP_HOST` | No | SMTP server host |
| `SMTP_PORT` | No | SMTP port (default `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `EMAIL_FROM` | No | Sender address (default `noreply@agedefy.ai`) |

---

## Database

Prisma schema: `prisma/schema.prisma`

```bash
# Generate client after schema changes
pnpm db:generate

# Push schema to DB (dev)
pnpm db:push

# Seed data
pnpm db:seed
```

### Key Models

`User` · `Account` · `Session` · `Workspace` · `Pathway` · `Compound` · `CompoundInteraction` · `AgingPathwayEffect` · `BiomarkerEntry` · `Protocol` · `ProtocolCompound` · `ProtocolTemplate` · `CommunityPost` · `Article` · `LabPanel` · `LabOrder` · `ClinicalTrial` · `TelehealthProvider` · `ConsultationRequest` · `Product` · `MarketplaceOrder` · `MarketplaceOrderItem` · `Subscription` · `AuditLog` · `ReviewItem`

For production, swap `DATABASE_URL` to a PostgreSQL connection string. The Prisma schema is database-agnostic.

---

## Authentication & Roles

NextAuth with credentials provider (email + bcrypt password).

| Role | Access |
|---|---|
| `MEMBER` | Default. Dashboard, biomarkers, community, marketplace, telemedicine |
| `CLINICIAN` | + Clinician task queue, consultation management |
| `RESEARCHER` | + Research ingestion, knowledge-graph editing |
| `ADMIN` | Full access. User management, audit logs, moderation, review queue |

Admins are auto-promoted when their email matches `ADMIN_EMAILS`.

Protected routes are enforced by middleware (`middleware.ts`): `/dashboard`, `/account`, `/admin`.

---

## API Routes

49 API route files organized under `app/api/`:

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/auth/verify-email` | Verify email token |

### Biomarkers
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/biomarkers` | List / create entries |
| GET/PUT/DELETE | `/api/biomarkers/[id]` | Get / update / delete entry |
| GET | `/api/biomarkers/trends` | Trend data for charts |

### Protocols
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/protocols` | List / create protocols |
| GET/PUT/DELETE | `/api/protocols/[id]` | Get / update / delete protocol |
| GET | `/api/protocols/templates` | Protocol template library |

### Pathways & Compounds
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pathways` | List aging pathways |
| GET | `/api/pathways/[id]` | Pathway detail with compounds |
| GET | `/api/compounds` | List compounds |
| GET | `/api/knowledge-graph` | Full knowledge graph |

### Community
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/community` | List / create posts |
| PUT/DELETE | `/api/community/[id]` | Edit / delete own post (or admin) |

### Learning Center
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/learn` | List / create articles |
| GET/PUT/DELETE | `/api/learn/[slug]` | Get / update / delete by slug |

### Lab Testing
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/lab-testing` | List lab panels |
| GET/POST | `/api/lab-testing/orders` | List / place lab orders |

### Telemedicine
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/telemedicine` | List providers / request consultation |
| GET/PATCH | `/api/telemedicine/consultations` | List / cancel consultations |

### Marketplace
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/marketplace` | List products (category filter) |
| GET/POST/PATCH | `/api/marketplace/orders` | List / place / cancel orders |

### Billing (Stripe)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/stripe/checkout` | Create checkout session |
| POST | `/api/stripe/webhook` | Stripe event handler |
| POST | `/api/stripe/portal` | Customer portal session |
| GET/POST | `/api/subscriptions` | List / create subscriptions |
| GET/PATCH | `/api/subscriptions/[id]` | Get / update subscription |

### AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/openai` | OpenAI chat completion |
| POST | `/api/ai/anthropic` | Anthropic chat completion |
| POST | `/api/ai/grok` | Grok chat completion |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/api/admin/users` | Change user role |
| GET/PATCH | `/api/admin/community` | Moderate community posts |
| GET/POST | `/api/admin/review-items` | Review queue |
| PATCH | `/api/admin/review-items/[id]` | Approve / reject item |
| GET | `/api/admin/audit-logs` | Query audit logs |
| GET | `/api/admin/audit-export` | Export audit CSV |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/search` | Global search |
| GET | `/api/health` | Health check |
| GET | `/api/account/profile` | User profile |
| DELETE | `/api/account/delete` | Delete account (GDPR) |
| GET | `/api/account/export` | Export user data (GDPR) |
| POST | `/api/research/ingest` | Ingest research papers |
| GET | `/api/research/clinical-trials` | Clinical trial search |
| GET | `/api/clinical-trials/search` | External trial search |
| GET | `/api/clinician-tasks` | Clinician task queue |
| POST | `/api/partner-data` | Partner data ingestion |

---

## Project Structure

```
app/
├── layout.tsx          # Root layout (Inter font, metadata, providers)
├── providers.tsx        # SessionProvider → ThemeProvider → LocaleProvider
├── page.tsx            # Landing page
├── not-found.tsx       # Custom 404
├── global-error.tsx    # Global error boundary
├── error.tsx           # Error boundary
├── globals.css         # Tailwind directives
├── account/            # Account settings page
├── admin/              # Admin console
├── clinical-trials/    # Clinical trials search
├── community/          # Community forum
├── dashboard/          # User dashboard
├── lab-testing/        # Lab panel ordering
├── learn/              # Learning center
├── marketplace/        # Supplement marketplace
├── mixer/              # Compound mixer
├── pathways/           # Aging pathway details
├── personalization/    # AI personalization
├── pricing/            # Pricing plans
├── research/           # Research hub
├── telemedicine/       # Telehealth directory
└── api/                # 49 API route files (see above)

components/
├── navigation.tsx      # Main nav bar with global search + language switcher
├── features.tsx        # 16-feature showcase grid
├── user-dashboard.tsx  # Dashboard widgets
├── ...                 # 30+ feature components
└── ui/                 # shadcn/ui primitives

lib/
├── auth.ts             # NextAuth config
├── db.ts               # Prisma client singleton
├── audit.ts            # Audit logging
├── logger.ts           # Structured JSON logger
├── rate-limit.ts       # Request rate limiting
├── utils.ts            # cn() helper
├── config/             # Billing catalog, feature flags
├── i18n/               # Locale context, translations loader
└── services/           # Email service (Nodemailer)

prisma/
├── schema.prisma       # Full data model (25+ models)
└── seed.ts             # Demo data seeder

__tests__/              # Vitest test suites
```

---

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

Tests use **Vitest** and cover:
- Zod validation schemas (biomarkers, protocols, community, auth, marketplace, telemedicine)
- Utility functions
- Business logic validators
- API input validation

---

## Linting & Type-checking

```bash
# ESLint
pnpm lint

# TypeScript
pnpm typecheck
```

CI runs both on every push (`.github/workflows/ci.yml`).

---

## Deployment

### Vercel (recommended)

1. Connect your Git repository to Vercel
2. Set environment variables in Vercel dashboard
3. Do not enable `ENABLE_TEST_AUTH_ENDPOINT` in shared dev, preview, staging, or production deployments. Reserve it for isolated test environments only.
4. Build command: `pnpm build` (auto-detected)
5. Swap `DATABASE_URL` to a hosted PostgreSQL (e.g., Neon, Supabase, Railway)

### Docker / Self-hosted

1. Build: `next build`
2. Start: `next start`
3. Ensure `DATABASE_URL` points to a PostgreSQL instance
4. Keep `ENABLE_TEST_AUTH_ENDPOINT` unset unless the deployment is an isolated, temporary test environment.
5. Run `pnpm db:push` and `pnpm db:seed` once

---

## Security

- **CSP, HSTS, X-Frame-Options** headers via `middleware.ts`
- **Rate limiting** on all API routes
- **Zod validation** on all user input
- **Bcrypt** password hashing
- **JWT** session tokens (no server-side sessions)
- **SHA-256** token hashing for email verification / password reset
- **Audit logging** for sensitive operations
- **GDPR** data export and account deletion
- **Role-based access control** (MEMBER, CLINICIAN, RESEARCHER, ADMIN)

---

## License

Private — all rights reserved.
