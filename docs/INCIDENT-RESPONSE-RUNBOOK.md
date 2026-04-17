# Incident Response Runbook

> **Format:** SOC 2 Type II compliant  
> **Last updated:** 2026-04-10  
> **Owner:** Security Team (security@biozephyra.com)

---

## 1. Purpose

This runbook defines the process for detecting, triaging, containing, eradicating, recovering from, and documenting security incidents affecting the Biozephyra platform.

---

## 2. Severity Classification

| Level | Name | Description | Response SLA |
|-------|------|-------------|--------------|
| SEV-1 | Critical | Data breach, production compromise, active exploitation | 15 min triage, 1 h containment |
| SEV-2 | High | Unauthorized access, service degradation, credential exposure | 1 h triage, 4 h containment |
| SEV-3 | Medium | Suspicious activity, failed intrusion attempt, vulnerability disclosure | 4 h triage, 24 h action |
| SEV-4 | Low | Policy violation, non-exploitable finding, informational | 24 h triage, 1 week action |

---

## 3. Detection

### Automated Detection Sources

| Source | What it detects | Alert mechanism |
|--------|----------------|-----------------|
| Rate-limit abuse monitor (`lib/rate-limit-monitor.ts`) | Repeated 429s from single IP exceeding abuse threshold (10 blocks / 5 min) | Creates `ReviewItem` with severity HIGH |
| Audit chain integrity (`lib/audit-integrity.ts`) | Tampered or broken audit log entries | `verifyAuditChain()` returns broken links — run on schedule |
| CodeQL / Trivy in CI | New vulnerabilities in code or dependencies | GitHub Security Alerts |
| Dependabot | Known CVEs in dependency tree | GitHub pull request |
| OpenTelemetry metrics | Anomalous request patterns, elevated error rates | Alerting via OTel exporter |

### Manual Detection

- Security researchers via responsible disclosure (`SECURITY.md`)
- Internal team audit of ReviewItem queue
- Customer-reported issues

---

## 4. Triage

### Step 1: Acknowledge

1. Assign an **Incident Commander (IC)** — any available team member with production access.
2. Create an incident record (internal doc or channel) with:
   - Incident ID: `INC-YYYY-MM-DD-NNN`
   - Time detected
   - Detection source
   - Initial severity
3. Notify stakeholders per severity:
   - SEV-1/2: Immediate Slack alert + email to engineering leads
   - SEV-3/4: Daily standup or async notification

### Step 2: Assess Scope

1. Which systems are affected? (API, database, AI providers, third-party integrations)
2. Which data is at risk? (PII, health data, credentials, API keys)
3. How many users are potentially affected?
4. Is the incident ongoing or historical?

### Step 3: Classify Data Impact

| Data class | Regulatory trigger |
|-----------|-------------------|
| Health biomarkers, lab results | GDPR Art. 9 (special category); HIPAA if applicable |
| Email, name, profile | GDPR Art. 4 (personal data) |
| API keys, session tokens | Credential compromise — force rotation |
| AI prompts/responses | IP and user context |

---

## 5. Containment

### Immediate Actions (within SLA)

| Action | Command / Procedure |
|--------|---------------------|
| Block suspicious IP | Update WAF / Vercel firewall rules |
| Revoke compromised sessions | `revokeAllSessions(userId)` via `lib/session-governance.ts` |
| Revoke compromised API keys | `revokeAPIKey(keyId, userId)` via `lib/api-keys/manager.ts` |
| Disable compromised user account | Set `user.role = 'USER'` + revoke sessions + audit log |
| Rotate exposed secrets | Regenerate `JWT_SECRET_KEY`, `FERNET_KEY`, provider API keys in Vercel env |
| Enable maintenance mode | Deploy a redirect or feature flag to block traffic to affected endpoints |

### Short-Term Containment

- Isolate affected database rows (add `quarantined: true` flag if needed)
- Disable the specific API route if exploitation vector is route-specific
- Adjust rate limits downward on affected endpoints

---

## 6. Eradication

1. Identify root cause (code vulnerability, configuration error, dependency CVE, social engineering)
2. Develop and test fix on a non-production branch
3. Submit PR with fix — requires review even under incident pressure
4. Deploy fix through standard CI pipeline
5. Verify fix by replaying the attack scenario in a test environment

---

## 7. Recovery

1. Restore normal operations:
   - Re-enable affected routes
   - Remove temporary blocks/maintenance mode
   - Update rate limits to normal levels
2. Verify system integrity:
   - Run `verifyAuditChain()` to confirm audit log integrity
   - Confirm all affected sessions and keys were rotated
   - Verify no residual unauthorized access
3. Monitor for recurrence:
   - Watch OTel dashboards for anomalies for 72 hours
   - Review ReviewItem queue daily for 1 week

---

## 8. Post-Mortem

Create a post-mortem document within **5 business days** of resolution:

### Template

```markdown
# Post-Mortem: INC-YYYY-MM-DD-NNN

## Summary
[One paragraph description]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Detection |
| HH:MM | Triage started |
| HH:MM | Containment actions |
| HH:MM | Fix deployed |
| HH:MM | Incident closed |

## Impact
- Users affected: N
- Data exposed: [type and scope]
- Duration: X hours

## Root Cause
[Technical description]

## Contributing Factors
- [Factor 1]
- [Factor 2]

## Resolution
[What was done to fix it]

## Action Items
| Action | Owner | Due |
|--------|-------|-----|
| [Preventive measure] | @name | YYYY-MM-DD |

## Lessons Learned
- [Lesson 1]
- [Lesson 2]
```

---

## 9. GDPR Breach Notification

If the incident involves personal data of EU residents:

| Obligation | Deadline | Action |
|-----------|----------|--------|
| Supervisory authority notification | **72 hours** from awareness | File report with relevant DPA including nature, categories, approximate number of data subjects, consequences, measures taken |
| Data subject notification | Without undue delay (if high risk) | Email affected users describing the breach, likely consequences, and measures taken |

---

## 10. Communication Templates

### Internal Escalation (SEV-1/2)

> **[INCIDENT] SEV-X: [Brief description]**
>
> Incident Commander: @name  
> Time detected: YYYY-MM-DD HH:MM UTC  
> Affected systems: [list]  
> Current status: [Triage / Containment / Eradication / Recovery]  
> Next update: [time]

### External Notification (if required)

> We identified a security issue affecting [description]. We have contained the impact and are actively mitigating. Affected users will be notified directly. We take the security of your data seriously and are implementing additional safeguards.

---

## 11. Runbook Maintenance

- Review and test this runbook **quarterly**
- Update after each real incident
- Conduct a tabletop exercise **annually**
