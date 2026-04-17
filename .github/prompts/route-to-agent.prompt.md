---
description: "Quick reference and invocation guide for Biozephyra repo-local specialization agents. Use to delegate a task to the right specialist."
name: "Biozephyra: Route to Agent"
argument-hint: "Task description or specialization: deploy, vercel, domain, legal"
agent: "biozephyra-wrapper"
---
Route the following task to the correct Biozephyra repo-local specialization:

Task or hint: {{arg}}

**Routing map:**

| Hint | Routes to | Scope |
|---|---|---|
| deploy / vercel / env / migration | `vercel-deployment-workflow-agent` | `next.config.mjs`, env docs, deploy guidance |
| domain / biomarker / science | `domain-agent` | longevity and health-science domain interpretation |
| workflow / business | `business-agent` | feature and process mapping |
| legal / compliance / jurisdiction | `law-awareness-agent` | `agents/legal-rules/` |

Apply the matched specialization's reasoning scope and runtime anchors before producing output.
