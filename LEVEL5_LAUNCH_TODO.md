# AgeDefy — Level 5 Launch TODO

> **Status:** Level 3.5 (true) → targeting Level 5 enterprise production-grade
> **Estimated time to Level 5:** 6–10 weeks focused work
> **Estimated investment:** $25k–$40k (SOC 2 + pen test + medical compliance + tooling)
> **Bootstrap path:** Launch B2C at Level 4 in 4–6 weeks, fund Level 5 from revenue + supplement affiliate cash flow
> **Last updated:** 2026-05-01

---

## Phase 0 — Reality Check (Days 1–3)

AgeDefy sits in **consumer health** — second-most regulated vertical after fintech. Make the scope decisions BEFORE writing more code.

- [ ] Decide: HIPAA-covered entity? (recommended: NO — accept no PHI from providers)
- [ ] Decide: telemedicine in V1? (recommended: NO — partner referrals only, no Rx, no diagnoses)
- [ ] Decide: lab integration in V1? (recommended: user-uploaded PDFs only, no direct LabCorp/Quest in V1)
- [ ] Decide: supplement marketplace model — affiliate vs. dropship vs. own inventory (recommended: affiliate only)
- [ ] Decide: launch geography — US-only V1 (avoid EU MDR for medical devices/SaMD risk)
- [ ] Document scope in `PRODUCT_SCOPE_V1.md`
- [ ] Reconcile `biozephyra-level4-report.md` findings — close or scope-defer
- [ ] Clean up loose artifacts (`jwt-test-out.txt`, `playwright-sign-in-smoke.png`, `typecheck.log`)

---

## Phase 1 — Launch Readiness (Weeks 1–2) — Required to Charge First Customer

### Legal & Medical Disclaimers (CRITICAL)
- [ ] Privacy Policy + ToS reviewed by attorney with health/wellness experience ($1k–$3k)
- [ ] **Medical disclaimer on every page**: "Not medical advice, consult licensed physician"
- [ ] **No diagnostic claims** — language audit on entire site
- [ ] **No treatment claims** — supplements pages must say "may support" not "treats/cures"
- [ ] **FDA structure/function claim language** for any supplement copy
- [ ] **FTC affiliate disclosure** on every page with affiliate links (must be conspicuous)
- [ ] **DSHEA compliance** for supplement claims
- [ ] **Cookie banner** + GDPR-style consent (even US-first)
- [ ] **State-level health coaching disclaimers** (CA, FL, NY have rules)
- [ ] **Age gate**: 18+ required (longevity is an adult product)

### Payment + Subscription
- [ ] Stripe production keys in Vault, webhook signing verified live
- [ ] Subscription tiers: Free / Pro $19/mo / Pro Annual $190/yr / Lifetime $499 (optional)
- [ ] Failed payment dunning (Stripe Smart Retries)
- [ ] Refund policy: 14-day money-back, documented + enforced
- [ ] Stripe Tax for US sales tax (supplements taxable in many states)
- [ ] Affiliate revenue tracking (PartnerStack or in-house)

### Email + Communications
- [ ] Postmark/Resend for transactional (separate from marketing)
- [ ] SPF + DKIM + DMARC at p=quarantine
- [ ] Dedicated sending domain (mail.agedefy.com)
- [ ] Email templates: signup, biomarker report, weekly digest, payment, password reset
- [ ] Unsubscribe one-click compliance (CAN-SPAM)

### AI Quality Gates (CRITICAL — health context = high liability)
- [ ] Biomarker analysis prompt: hard rules forbidding diagnosis/treatment language
- [ ] Hallucination eval suite: 50+ golden biomarker panels with expected interpretations
- [ ] Citation requirement: every claim links to PubMed/primary source
- [ ] Output reviewed against denylist of medical advice phrases ("you have," "you should take," "this means you")
- [ ] All AI output ends with "Discuss with your healthcare provider"
- [ ] Prompt versioning + rollback mechanism

### Mobile + Performance
- [ ] Mobile responsive (biohacker audience uses phones for daily logging)
- [ ] Lighthouse mobile score ≥85
- [ ] PWA manifest + offline biomarker viewing
- [ ] Push notifications for daily protocol reminders (web push V1, native later)

---

## Phase 2 — Production Hardening (Weeks 3–4)

### Reliability
- [ ] PostgreSQL Multi-AZ (RDS Multi-AZ or Neon HA tier)
- [ ] Hourly automated backups + daily snapshots, off-region copy
- [ ] PITR window 30 days
- [ ] Restore drill: documented + executed in <1 hour, signed off monthly
- [ ] Health checks on all services (k8s readiness/liveness already configured)
- [ ] Outbox pattern audit for `prisma.outbox.config.ts` event publishing

### Security
- [ ] Rotate all API keys → Vault/Doppler/Infisical
- [ ] CSP enforce mode + report-uri
- [ ] HSTS preload submitted
- [ ] Image scanning (Trivy in CI), block CRITICAL CVEs
- [ ] Dependency renovation (Dependabot/Renovate weekly)
- [ ] PostgreSQL row-level security per user
- [ ] Encryption at rest (DB, S3) + in transit (TLS 1.3 enforced)
- [ ] BYOK option for Pro+ users (BIOMARKER DATA = SENSITIVE)
- [ ] All admin routes require re-auth + TOTP
- [ ] Rate limit all public endpoints (per IP + per user)
- [ ] CAPTCHA on signup + password reset (Cloudflare Turnstile)
- [ ] SSRF prevention on supplement-marketplace image fetching
- [ ] Webhook signature verification on Stripe + any inbound integrations

### Observability
- [ ] Sentry production project, source maps uploaded
- [ ] OpenTelemetry traces → Grafana Cloud or Honeycomb
- [ ] Synthetic checks every 60s on critical flows: signup, biomarker upload, AI analysis
- [ ] Status page live (status.agedefy.com via instatus.com)
- [ ] PagerDuty / Opsgenie wired to SEV1 alerts
- [ ] Incident response playbook + first mock drill executed
- [ ] Error budget dashboard (SLO target: 99.9% successful API requests)

---

## Phase 3 — Compliance + Trust (Weeks 5–7)

### Privacy (Health Data = Sensitive)
- [ ] CCPA + GDPR + state laws (CO, VA, CT, UT, TX) DSAR flow live
- [ ] Health data classified separately (potential CMIA in California)
- [ ] Self-service data export (JSON of all biomarkers, protocols, journal entries)
- [ ] Right to be forgotten cascade: app DB → Stripe → email → analytics → backups
- [ ] Subprocessor list public + linked from privacy policy
- [ ] DPA template signable (DocSeal / Dropbox Sign)
- [ ] Cookie consent CMP (Cookiebot or Osano)
- [ ] **Sensitive data category**: explicit user consent at upload (biomarkers, body composition)

### SOC 2 Type II (Required for any future B2B clinic/employer offering)
- [ ] Vanta / Drata / Secureframe contract signed (~$15k/yr)
- [ ] Auto-evidence collection wired (AWS, GitHub, Sentry, Stripe)
- [ ] 90-day Type II observation window starts
- [ ] Penetration test booked (Cobalt / Doyensec — $10k–$20k)
- [ ] Trust center live (trust.agedefy.com)

### Insurance
- [ ] E&O / Professional Liability ($1M, ~$2k–$4k/yr — health context premium)
- [ ] Cyber Liability ($2M–$3M, ~$2k–$5k/yr)
- [ ] Product Liability for any branded supplements ($1M, ~$2k/yr if affiliate-only this is lower)
- [ ] General Liability ($1M, ~$500/yr)

### Regulatory
- [ ] FDA non-claims audit by health/wellness attorney (1-time, $1k–$3k)
- [ ] FTC endorsement guides compliance audit (affiliate disclosures)
- [ ] State medical board review (avoid practicing medicine without license)
- [ ] If telemedicine added: state-by-state licensing partner (Wheel/SteadyMD/Hims model)

---

## Phase 4 — Scale + Resilience (Weeks 8–10)

### Performance
- [ ] CDN in front of all assets (Cloudflare)
- [ ] Image optimization (Cloudflare Images or Bunny)
- [ ] Read replica for analytics + dashboards
- [ ] Redis for session, rate limit, computed biomarker scores
- [ ] k6 load test: 1000 concurrent, p95 <500ms
- [ ] WAF tuned (Cloudflare WAF rules)
- [ ] Autoscaling tested at 10x baseline
- [ ] Chaos drill: kill DB primary, verify failover <60s

### Multi-Region (Optional for V1, required for Level 5)
- [ ] Decide: us-east-1 only V1 → multi-region V2
- [ ] Read-replica in us-west-2 (or eu-west-1 for EU launch)
- [ ] DNS failover via Cloudflare Load Balancing or Route53 health checks

### Distribution + Growth
- [ ] ProductHunt launch prepped (assets, hunters, day-of plan)
- [ ] Biohacker Twitter/X seed list (200 accounts to engage pre-launch)
- [ ] r/longevity, r/Biohackers, r/Nootropics presence (helpful, not spammy)
- [ ] Bryan Johnson / Peter Attia / Andrew Huberman audience targeting
- [ ] Partner with longevity influencers (5–10 affiliate codes at 30%)
- [ ] Programmatic SEO: 100 biomarker reference pages ("What does high HbA1c mean?")
- [ ] Newsletter (weekly longevity digest)
- [ ] Wearable OAuth integrations: Apple Health, Oura, Whoop, Fitbit, Garmin
- [ ] Affiliate revenue dashboards (iHerb, Thorne, Pure Encapsulations)

### Native Mobile (Major Unlock)
- [ ] Capacitor wrapper or React Native shell → iOS App Store + Google Play
- [ ] Apple Health deep integration (write biomarker entries)
- [ ] Push notifications (protocol reminders, lab result ready)
- [ ] Apple Subscription / Google Play Billing (note: 30% Apple tax — keep web subs primary)

---

## AgeDefy-Specific Risk & Polish

### Scope Decisions to Lock
- [ ] Telemedicine module: **partner referrals only V1** (Wheel/SteadyMD/Hims) → no Rx, no diagnoses
- [ ] Lab integration: **user-uploaded PDFs V1** → Quest/LabCorp HL7 FHIR V2
- [ ] Wearable integration: Apple Health + Oura + Whoop OAuth V1
- [ ] Supplement marketplace: **affiliate-only V1** (iHerb, Thorne, Fullscript)
- [ ] Scientist sponsor marketplace: scope decision (`scientist-sponsor-marketplace/` exists in repo)

### Product Polish
- [ ] Biomarker reference ranges sourced from primary literature (cite every range)
- [ ] Protocol library curated (David Sinclair, Bryan Johnson Blueprint, Peter Attia)
- [ ] Daily check-in flow: 30-second mobile-first
- [ ] Trends/charts visualizations (`charts/` folder leveraged)
- [ ] Data export (CSV + PDF reports for sharing with provider)
- [ ] Provider portal (read-only share link to physician)

---

## Launch Day Checklist

- [ ] All Phase 0–2 items closed (Phases 3–4 acceptable post-launch for B2C)
- [ ] Status page live and green
- [ ] On-call rotation defined
- [ ] Rollback plan documented + tested
- [ ] ProductHunt launch coordinated
- [ ] Biohacker Twitter blast scheduled
- [ ] First newsletter sent
- [ ] First affiliate codes distributed to influencers
- [ ] Customer support inbox monitored (help@agedefy.com)
- [ ] Goal: 500 free signups + 25 paid in first 14 days

---

## Success Metrics (First 90 Days)

| Metric | Day 14 | Day 30 | Day 60 | Day 90 |
|---|---|---|---|---|
| Free signups | 500 | 2,000 | 6,000 | 12,000 |
| Paid users ($19/mo) | 25 | 100 | 350 | 800 |
| Subscription MRR | $475 | $1,900 | $6,650 | $15,200 |
| Affiliate revenue | $200 | $800 | $2,500 | $5,000 |
| Total monthly revenue | $675 | $2,700 | $9,150 | $20,200 |
| Churn (monthly) | — | <12% | <9% | <7% |
| Uptime | 99.5% | 99.7% | 99.9% | 99.95% |

---

## Investment Summary

| Category | Cost (USD) |
|---|---|
| Vanta/Drata SOC 2 tooling | ~$15,000/yr |
| Penetration test | $10,000–$20,000 |
| Insurance (E&O + Cyber + Product + GL) | $6,000–$11,000/yr |
| Legal review (privacy, FDA, FTC, state medical) | $3,000–$8,000 |
| Status page + monitoring | $0–$500/mo |
| Email + transactional | $50–$300/mo |
| Hosting + infra | $300–$1,500/mo |
| Wearable API access fees | $0–$300/mo |
| **Total Year 1** | **~$45,000–$70,000** |

**Realistic Year 1 revenue:** $50k–$180k (subscription + affiliate combined)
**Bootstrap viable:** Soft-launch at Level 4 in 4–6 weeks, fund Level 5 over 6 months from MRR

---

## Bootstrap Sequencing (No Outside Capital)

1. **Weeks 1–4:** Phase 0 + Phase 1 → soft launch on ProductHunt
2. **Weeks 4–8:** Reach $2k MRR + $1k affiliate → fund pen test
3. **Months 2–4:** Reach $5k MRR → fund SOC 2 tooling
4. **Months 4–8:** Reach $10k–$15k MRR → mobile app launch
5. **Months 8–12:** Reach $20k+ MRR → telemedicine partner integration
6. **Year 2:** Lab integration + B2B clinic offering

---

## Killer Combos to Stack Revenue

- **Subscription + Affiliate**: Pro users buy supplements through your store → 5–15% commission per order on top of $19/mo
- **Influencer partnerships**: 30% rev-share for 12 months (Bryan Johnson community has high purchase intent)
- **Annual upsell**: Convert 30% of monthly to annual → reduces churn + cash up front
- **Done-for-you protocols**: $99 one-time for personalized supplement stack recommendation (high margin)
- **Provider tier**: $99/mo for clinics (HIPAA conditional) → high ACV upsell at month 12+
