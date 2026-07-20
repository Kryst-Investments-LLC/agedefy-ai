# Incident Communication Templates

Fill-in-the-blank templates for security-incident and vulnerability-disclosure
communications. They exist so nobody has to draft comms under pressure during a
live incident. Companion to the top-level [`SECURITY.md`](../../SECURITY.md)
(disclosure process, contact, and severity SLA) and the operational steps in
[`docs/runbooks/production-launch-runbooks.md`](../runbooks/production-launch-runbooks.md).

`{{placeholders}}` are substituted per incident. Keep every external message
factual — never speculate on root cause or scope before it is confirmed.

---

## 1. Reporter acknowledgement (send within 24h)

> Subject: Re: Security report — acknowledged ({{report_ref}})
>
> Hi {{reporter_name}},
>
> Thank you for reporting this to us and for doing so responsibly. We have
> received your report and assigned it reference **{{report_ref}}**. Our security
> team is triaging it now and will follow up with an initial severity assessment
> within 72 hours.
>
> If you have additional details (proof-of-concept, affected endpoints, logs),
> please reply to this thread. Please continue to keep this issue confidential
> until we confirm a fix is in place, per our disclosure policy.
>
> — Biozephyra Security

## 2. Reporter triage / status update (72h, then every 7 days)

> Subject: Re: Security report {{report_ref}} — {{status}}
>
> Hi {{reporter_name}},
>
> Update on {{report_ref}}: we have {{confirmed / been unable to reproduce}} the
> issue and assessed it as **{{severity}}**. Current status: {{status}}.
> {{next_step_and_eta}}
>
> We will send the next update by {{next_update_date}} or sooner if the status
> changes. Thank you again for your help.
>
> — Biozephyra Security

## 3. Reporter resolution notice

> Subject: Re: Security report {{report_ref}} — resolved
>
> Hi {{reporter_name}},
>
> The issue you reported ({{report_ref}}, severity {{severity}}) has been
> {{fixed and deployed / mitigated}} as of {{resolution_date}}. {{summary_of_fix}}
>
> With your permission we would like to credit you on our security
> acknowledgements page as **{{credit_name}}**. Please let us know if you prefer
> to remain anonymous, and whether/when you plan any public write-up so we can
> coordinate.
>
> — Biozephyra Security

---

## 4. Internal incident declaration (Sev1 / Sev2)

Post to the incident channel the moment an incident is declared.

> **INCIDENT DECLARED — {{sev}}** — {{short_title}}
> - **Incident ref:** {{incident_ref}}
> - **Declared:** {{timestamp_utc}} by {{declarer}}
> - **Incident commander:** {{ic}}
> - **Impact (confirmed):** {{what_is_affected}}
> - **Impact (suspected):** {{what_might_be_affected}}
> - **PHI/PII exposure:** {{yes / no / under-investigation}}
> - **Customer-facing?** {{yes / no}}
> - **Current action:** {{containment_step_in_progress}}
> - **Next update:** {{time}}
>
> Roles: IC {{ic}} · Comms {{comms_lead}} · Ops {{ops_lead}} · Scribe {{scribe}}.
> All updates in this thread. Do not discuss outside the incident channel.

## 5. Status-page / customer holding update (while investigating)

> **{{Investigating / Identified / Monitoring}} — {{service}}**
> {{timestamp_utc}} — We are investigating {{observed_symptom}} affecting
> {{scope}}. {{what_users_may_experience}}. Our team is engaged and the next
> update will be posted by {{next_update_time}}.

## 6. Public security advisory (post-fix)

Publish via GitHub Security Advisory and/or changelog **after** the fix is
deployed. Do not include reproduction detail that enables exploitation of
unpatched deployments.

> **Security advisory {{advisory_id}} — {{title}}**
> - **Severity:** {{severity}} ({{cvss_vector}})
> - **Affected:** {{component / versions}}
> - **Fixed in:** {{version / deploy date}}
> - **Summary:** {{one-paragraph non-exploitable description of the class of issue}}
> - **Impact:** {{who/what was at risk}}
> - **Remediation:** {{what users must do — usually "no action required, fix is
>   deployed" for the hosted app; upgrade instructions for self-hosted}}
> - **Credit:** {{reporter, with permission}}

---

## 7. Data-breach notification (personal / health data)

Trigger the legal/DPO review immediately on any **confirmed** personal-data
breach. Under GDPR Art. 33 a notifiable breach must reach the supervisory
authority **within 72 hours** of becoming aware; Art. 34 requires notifying
affected individuals **without undue delay** when the risk to them is high.
Do not send external breach notices without sign-off from {{dpo}} and legal.

### 7a. Supervisory-authority notification (GDPR Art. 33 — within 72h)

> - **Controller:** Biozephyra AI · DPO: {{dpo_contact}}
> - **Date/time became aware:** {{timestamp_utc}}
> - **Nature of breach:** {{confidentiality / integrity / availability}} —
>   {{description}}
> - **Categories & approx. number of data subjects:** {{count / categories}}
> - **Categories & approx. number of records:** {{count / categories}}
> - **Likely consequences:** {{assessment}}
> - **Measures taken / proposed:** {{containment, remediation, mitigation}}
> - **Whether individuals notified:** {{yes / no / planned — with rationale}}

### 7b. Affected-individual notification (GDPR Art. 34)

> Subject: Important security notice about your Biozephyra account
>
> Dear {{user_name}},
>
> We are writing to inform you of a security incident that {{may have / did}}
> affect{{ed}} some of your information. On {{date}} we {{discovered / were
> notified of}} {{plain-language description}}. The information involved was
> {{data categories}}. {{What we have confirmed was NOT affected, if applicable —
> e.g. passwords remain hashed, payment card data is not stored by us.}}
>
> **What we are doing:** {{containment and remediation in plain language}}.
>
> **What you should do:** {{concrete steps — reset password, watch for phishing,
> etc., or "no action is required on your part"}}.
>
> We sincerely apologize. For questions, contact {{support_or_dpo_contact}}.
>
> — The Biozephyra Team

---

## Severity → response-time reference

Mirror of the SLA in [`SECURITY.md`](../../SECURITY.md); use for internal
scheduling of the updates above.

| Severity | Reporter ack | Triage | Target fix / mitigation |
|----------|--------------|--------|-------------------------|
| Critical | 24h          | 72h    | 7 days                  |
| High     | 24h          | 72h    | 14 days                 |
| Medium   | 24h          | 7 days | 30 days                 |
| Low      | 24h          | 7 days | Next release            |
