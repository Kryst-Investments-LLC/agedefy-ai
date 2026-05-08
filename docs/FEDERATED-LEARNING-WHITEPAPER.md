# Federated Learning — Technical Whitepaper

> Biozephyra Privacy-Preserving Collaborative AI

**Version:** 1.0  
**Status:** Implemented (Sprint 6)  
**Last updated:** 2025

---

## 1. Executive Summary

Biozephyra uses **Federated Learning (FL)** to improve its bio-age prediction models using insights from user health data without that data ever leaving the user's device. This approach enables collaborative model improvement while providing formal privacy guarantees through differential privacy and secure aggregation.

**Key properties:**

- Raw health data never leaves the client
- Only differentially-private model gradients are shared
- Secure aggregation prevents the server from inspecting individual updates
- Formal privacy budget (ε) limits cumulative information leakage

---

## 2. Architecture

### 2.1 System Components

```
┌────────────────────────────────────────────────────────┐
│                    Biozephyra Client                       │
│                                                        │
│  ┌──────────┐   ┌──────────┐   ┌───────────────────┐  │
│  │ Bio Data │──▶│ Local    │──▶│ DP-SGD            │  │
│  │ (never   │   │ Training │   │ (clip + noise)    │  │
│  │ leaves)  │   │          │   └────────┬──────────┘  │
│  └──────────┘   └──────────┘            │              │
│                                         ▼              │
│                              ┌───────────────────────┐ │
│                              │ Secure Aggregation    │ │
│                              │ (mask gradients)      │ │
│                              └────────┬──────────────┘ │
└───────────────────────────────────────┼────────────────┘
                                        │ encrypted gradients only
                                        ▼
┌────────────────────────────────────────────────────────┐
│                   FL Server (Flower)                    │
│                                                        │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │ FedAvg        │  │ Model         │  │ Privacy    │ │
│  │ Aggregation   │  │ Registry      │  │ Accountant │ │
│  └───────┬───────┘  └───────────────┘  └────────────┘ │
│          │                                             │
│          ▼                                             │
│  ┌───────────────┐                                     │
│  │ Global Model  │──▶ Published for inference          │
│  └───────────────┘                                     │
└────────────────────────────────────────────────────────┘
```

### 2.2 Component Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| FL Client Adapter | `lib/fl/client.ts` | HTTP adapter to Flower server |
| Server Config | `lib/fl/server-config.ts` | Strategy, hyperparams, architectures |
| Gradient Privacy | `lib/fl/gradient-privacy.ts` | DP-SGD (clip + Gaussian noise) |
| Secure Aggregation | `lib/fl/secure-aggregation.ts` | Mask-based gradient protection |
| Model Registry API | `app/api/fl/models/route.ts` | Register and list FL models |
| Participation API | `app/api/fl/participate/route.ts` | Record training contributions |
| Consent Gate | `components/fl/fl-consent-gate.tsx` | Consent-gated FL UI wrapper |
| Admin Dashboard | `app/admin/fl/page.tsx` | Training monitoring |

---

## 3. Privacy Guarantees

### 3.1 Differential Privacy (DP-SGD)

Each client applies **DP-SGD** (Abadi et al., 2016) before sharing any gradient:

1. **Gradient clipping:** Per-sample gradients are clipped to L2 norm ≤ $C$ (default $C = 1.0$)
2. **Gaussian noise:** Calibrated noise $\mathcal{N}(0, \sigma^2)$ is added where $\sigma = \frac{z \cdot C}{B}$, $z$ is the noise multiplier (default 1.1), and $B$ is the batch size
3. **Privacy accounting:** Per-step epsilon is bounded by:

$$\varepsilon_{\text{step}} = \frac{\sqrt{2 \ln(1.25/\delta)} \cdot \Delta f}{\sigma}$$

where $\delta = 10^{-5}$ and $\Delta f = C / B$.

### 3.2 Composition Theorem

Total privacy loss after $T$ rounds uses advanced composition (Kairouz et al., 2015):

$$\varepsilon_{\text{total}} \leq \sqrt{2T \cdot \ln(1/\delta)} \cdot \varepsilon_{\text{step}} + T \cdot \varepsilon_{\text{step}} \cdot (e^{\varepsilon_{\text{step}}} - 1)$$

With default settings ($\varepsilon_{\text{total}} = 8.0$, $T = 50$ rounds), the per-round budget is $\varepsilon_{\text{round}} \approx 0.16$.

### 3.3 Secure Aggregation

Individual gradient updates are masked before transmission:

1. Each client generates a random mask from a cryptographic seed
2. Mask is added to the gradient vector before sending
3. Server aggregates masked updates; with sufficient participants ($n \geq 3$), random masks approximately cancel in the mean
4. Commitment hashes (SHA-256) verify integrity post-aggregation

### 3.4 Consent

FL participation requires active GDPR consent (`research-usage` category). The consent gate:

- Explains what stays local vs. what is shared
- Links to the consent management page
- Blocks all FL features until consent is granted
- Can be revoked at any time

---

## 4. Aggregation Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **FedAvg** (default) | Weighted average of client updates by local dataset size | IID data distributions |
| **FedProx** | Adds proximal regularisation term ($\mu = 0.01$) | Non-IID / heterogeneous clients |
| **FedAdam** | Server-side adaptive optimisation of aggregated gradients | Non-convex objectives |

---

## 5. Model Architecture

The default model is a multi-layer perceptron predicting the **bio-age delta** (predicted improvement from a protocol):

| Architecture | Layers | Params | Use Case |
|-------------|--------|--------|----------|
| `mlp-3-64` (default) | 3 × 64 | 8,641 | General tabular biomarker data |
| `mlp-2-128` | 2 × 128 | 23,169 | Fewer available features |
| `mlp-4-32` | 4 × 32 | 3,553 | Better with DP (fewer params → less noise impact) |

**Input features (50-dim):**

- Normalised biomarker values (0-1 scale)
- Protocol duration and compound count
- Generalised demographic bucket (age decade, sex)

**Output:** Predicted bio-age delta (positive = improvement)

---

## 6. Training Protocol

### 6.1 Round Lifecycle

1. Server publishes global model weights for round $r$
2. Eligible clients (with consent) receive training task with hyperparameters
3. Each client trains locally on their data for $E$ epochs (default 3)
4. Client applies DP-SGD (clip + noise) to resulting gradients
5. Client masks gradients via secure aggregation
6. Server collects ≥ $K_{\text{min}}$ (default 5) masked updates
7. Server aggregates using FedAvg (or configured strategy)
8. Privacy accountant records $\varepsilon$ spent this round
9. Updated global model is published

### 6.2 Default Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Learning rate | 0.01 | Standard for tabular data |
| Local epochs | 3 | Balance local learning vs drift |
| Batch size | 32 | Standard mini-batch |
| Max gradient norm | 1.0 | DP clipping threshold |
| Noise multiplier | 1.1 | Moderate privacy/utility trade-off |
| Min clients/round | 5 | Statistical sufficiency |
| Total rounds | 50 | Convergence with ε = 8.0 |
| Round timeout | 300s | Accommodates slow clients |

---

## 7. Threat Model

### 7.1 What We Protect Against

| Threat | Mitigation |
|--------|------------|
| **Honest-but-curious server** | Secure aggregation prevents inspecting individual updates |
| **Gradient inversion attacks** | DP noise makes reconstruction infeasible |
| **Membership inference** | Formal DP guarantee bounds leakage per-sample |
| **Model poisoning** | Gradient clipping limits the impact of any single client |
| **Data exfiltration** | Raw data never leaves the client |

### 7.2 Assumptions

- The FL server (Flower) is operated by Biozephyra and follows the protocol honestly
- At least $K_{\text{min}}$ clients participate per round for aggregation quality
- Clients run the unmodified Biozephyra client code
- The consent system is enforced at the API layer

### 7.3 Limitations

- **Non-IID data**: User biomarker distributions may vary significantly. FedProx can mitigate this.
- **Stragglers**: Round timeout may exclude slow clients, reducing representation.
- **Small user base**: With few participants, aggregation quality decreases and masks are less effective.
- **ε budget exhaustion**: Once the total ε budget (8.0) is consumed, training must stop to maintain privacy guarantees.

---

## 8. Integration with Recommendations

FL model predictions are blended into the recommendation engine:

1. Published FL model generates predictions for compound/protocol effectiveness
2. Predictions with confidence ≥ 0.5 boost recommendation relevance by up to 15%
3. High-confidence predictions (≥ 0.8) can upgrade evidence quality from "low" to "moderate"
4. FL predictions are displayed alongside aggregate outcome data in the UI

This creates a **flywheel effect**: more participants → better model → better recommendations → more engagement → more participants.

---

## 9. Compliance

| Requirement | Implementation |
|-------------|---------------|
| **GDPR Art. 6** | Explicit consent required (`research-usage` category) |
| **GDPR Art. 7** | Consent can be withdrawn at any time |
| **GDPR Art. 25** | Privacy by design — raw data never transmitted |
| **GDPR Art. 35** | Formal DP guarantees with bounded ε |
| **Data minimisation** | Only generalised features and noised gradients shared |

---

## 10. References

1. Abadi, M., et al. (2016). "Deep Learning with Differential Privacy." CCS '16.
2. McMahan, B., et al. (2017). "Communication-Efficient Learning of Deep Networks from Decentralized Data." AISTATS '17.
3. Bonawitz, K., et al. (2017). "Practical Secure Aggregation for Privacy-Preserving Machine Learning." CCS '17.
4. Kairouz, P., Oh, S., & Viswanath, P. (2015). "The Composition Theorem for Differential Privacy." ICML '15.
5. Li, T., et al. (2020). "Federated Optimization in Heterogeneous Networks." MLSys '20 (FedProx).
6. Beutel, D.J., et al. (2020). "Flower: A Friendly Federated Learning Framework." arXiv:2007.14390 (Flower).
