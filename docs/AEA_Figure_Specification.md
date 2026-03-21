# AEA Architecture Figure — Master Specification
## Publication-Grade Two-Panel Figure for High-Impact Journal Submission

**Document status:** Revised master specification  
**Replaces:** All prior draft figure instructions  
**Incorporates:** Prior sanity-review corrections plus March 2026 consistency and standards-currency reconciliation  
**Target venues:** IEEE Transactions, Elsevier Computers in Industry, Springer JINT, IFAC journals  

---

## Part 0 — What this figure must prove

Before any layout decision is made, the figure must let a reviewer verify six independent architectural claims in a single reading. Every component, every arrow, and every label must serve one or more of these six claims. If a proposed element cannot be traced to at least one of them, it does not belong in the figure.

| Claim | What the figure must show | Primary standards anchor |
|---|---|---|
| **C1** | The agent lives entirely in the NOA M+O domain, never inside CPC | NAMUR NE 175 — three information domains |
| **C2** | Sensing is read-only; the data path is unidirectional through a hardware/logical diode | NAMUR NE 177 — three gateway modules, no feedback path |
| **C3** | Decision-making is semantically grounded by PA-DIM and AAS, and is constrained by external policy, retrieval, schema, and approval gates before VoR emission | OPC 30081 PA-DIM v1.02; IEC 63278-1:2023; NIST AI RMF 1.0 |
| **C4** | Actuation is never direct; the exclusive write-back channel is VoR, which enforces a five-step domain-transition protocol | NAMUR NE 178 (2025-03-10) |
| **C5** | Northbound telemetry (KPI publication) is publish-only and decoupled from the actuation path | OPC UA Part 14 v1.05.06; MQTT v5.0 |
| **C6** | AI safety controls are deterministic and external to the model | OWASP Top 10 for LLM Applications 2025; NIST AI 600-1 Generative AI Profile |

---

## Part 1 — Figure composition and physical layout

### 1.1 Two-panel structure

The figure consists of exactly **two panels**:

- **Panel A** — Static system architecture across NOA zones (full width)  
- **Panel B** — Dynamic VoR domain-transition sequence (inset or row beneath Panel A)

**Rationale:** Panel A contains three swimlanes, a security gateway block, the full Decide-band guardrail layer, and a dense actuation corridor. Adding the five-step VoR ribbon into Panel A would make text illegible at journal print size. Panel B elaborates the NE 178 domain-transition protocol while Panel A shows the pre-VoR AEA guardrails that feed it.

Do **not** label them "Figure 1a" and "Figure 1b" — label them **(a)** and **(b)** per IEEE/Elsevier convention.

### 1.2 Master dimensions

| Parameter | Value | Authority |
|---|---|---|
| Total figure width | 183 mm | Nature double-column; Elsevier double-column |
| Panel A height | 110–120 mm | Empirical: fits three bands + gateway at 6pt text |
| Panel B height | 30–35 mm | Five blocks in a linear ribbon |
| Minimum font size (final artwork) | 5 pt | Nature figure guide |
| Target font size (labels) | 6–7 pt | IEEE author guidelines |
| Standard font | Helvetica Neue or Arial | Nature, IEEE, Elsevier all accept |
| Colour space | RGB | Required for online publication; CMYK conversion handled by publisher |
| File format | PDF (vector, editable layers, embedded fonts) | Safest cross-publisher format |
| Resolution (if rasterised fallback needed) | 600 dpi at final print size | Elsevier minimum for combination figures |

**Do not outline text.** Embed all fonts in the submitted PDF. Do not include source-reference labels (journal names, DOIs, "see §X") inside the figure — those belong in the caption.

### 1.3 Swimlane layout (Panel A)

Draw **three vertical swimlanes** from left to right, separated by solid thin borders (0.5 pt). Use light fill colours (e.g. very pale grey #F5F5F5 for Lane A, white for Lane B, pale blue-grey #EEF2F7 for Lane C) to visually separate zones without introducing print-unsafe colours.

| Lane | Title | Represents | NOA domain |
|---|---|---|---|
| **A** | Core Process Control (CPC / OT) | DCS, PLC, field devices | CPC |
| **B** | Plant-specific M+O (psM+O, on-prem edge) | Autonomous Edge Agent | psM+O |
| **C** | Central M+O (off-prem) | Cloud analytics, historians | Central M+O |

Width ratios (as fractions of total figure width): A ≈ 0.22, B ≈ 0.52, C ≈ 0.26. Lane B is widest because it contains the most components.

### 1.4 Security Gateway block

Place a tall, vertically oriented **boundary box** between Lane A and Lane B, straddling the lane border. Title it:

> **NOA Security Gateway**  
> *(NE 177 / NE 178)*

Give it a distinct, slightly darker border (1 pt, colour #4A6FA5) and a very pale interior fill to distinguish it from the swimlane backgrounds. This box contains two logically distinct sections, separated by an internal horizontal rule:

**Upper section (NE 177):** Read-only transfer chain — three stacked submodules (see §4)  
**Lower section (NE 178):** VoR Interface — write-back and status feedback (see §5)

---

## Part 2 — Lane A: Core Process Control

Place these three blocks in Lane A, stacked vertically from top to bottom:

### Block A1 — CPC System
**Label:** CPC System (DCS / PLC)  
**No badge required** (this is a generic block; specific DCS brands are out of scope)  
**Note (small, inside block):** SIL-rated; independent of M+O agent

### Block A2 — CPC Data Interface
**Label:** CPC Data Interface  
**Subtitle:** OPC UA Server · PA-DIM information model  
**Badge:** OPC UA IEC 62541  
**Role:** This is the *source* of all telemetry. It exposes device data in PA-DIM format via OPC UA. It is a **read-only endpoint from the perspective of the NOA security gateway** — the gateway reads from it; nothing writes through it.

### Block A3 — CPC Change Handler
**Label:** CPC Change Handler  
**Subtitle:** Executes or queues VoR-accepted changes  
**Badge:** NE 178 §5 (Execution step)  
**Critical design note:** This block is the *exclusive write target* for VoR write-back (arrow F6 terminates here, not at the CPC Data Interface). Placing the write-back endpoint at the CPC Data Interface is a common error that confusingly suggests writing into the read-only sensing endpoint. The CPC Change Handler is a separate logical component that receives mapped, verified, and accepted instructions from the VoR Interface and executes them within CPC under its own SIL constraints.

**Internal CPC arrow:**  
`F_CPC_INT:` Block A3 → Block A1  
Label: *execute verified change*  
Style: medium solid arrow, entirely within Lane A  
(This arrow is optional; include it if space permits; omit if the figure becomes crowded, and explain it in the caption.)

---

## Part 3 — Lane B: Autonomous Edge Agent (AEA)

Draw one large rounded rectangle in Lane B titled:

> **Autonomous Edge Agent (AEA)**  
> *(psM+O edge node)*

Inside this rectangle, place **three horizontal bands** from top to bottom, each labelled with a small band title on the left margin:

| Band | Title | Purpose |
|---|---|---|
| **Sense** | Sense | Data acquisition and normalisation |
| **Decide** | Decide | Reasoning, retrieval, policy-guarded planning |
| **Act** | Act | Validated actuation and KPI publication |

Separate bands with a thin dashed internal horizontal line (0.3 pt) to indicate logical sub-divisions within the same agent, not security boundaries.

---

## Part 4 — Sense band (detailed)

### Components

**Block S1 — OPC UA Client (read-only)**  
Label: OPC UA Client  
Subtitle: *read-only session · subscribes to PA-DIM nodes*  
Badge: none (client role is defined by F1 label)  
Note: This client holds a certificate authorised for *read* operations only. Its session role is provisioned by the OPC UA server in the Security Gateway (G3 side), not self-assigned.

**Block S2 — PA-DIM Harmonizer**  
Label: PA-DIM Harmonizer  
Subtitle: *normalises heterogeneous device signals; assigns IEC 61987 IRDIs; time-stamps feature vector (t₀)*  
Badge: **OPC 30081 PA-DIM v1.02** *(released 2026-01-24)*  
**Critical note:** The Harmonizer must be labelled with v1.02, not v1.01 (the prior draft used v1.01, which is outdated). The t₀ time-stamp annotation is architecturally important — both F3d (to LLM) and F3h (to Validators) must draw from the same frozen snapshot to prevent temporal inconsistency between reasoning state and validation state.

### Sense band arrows

**F_GW1** (Gateway-internal, but shown entering gateway):  
Source → Target: Block A2 → G1  
Label: *OPC UA subscription (PA-DIM topics)*  
Style: solid, medium weight, crosses Lane A → Gateway boundary  
Direction: left-to-right

**F_GW2** (Gateway-internal):  
Source → Target: G1 → G2  
Label: *unidirectional ingress*  
Style: solid, medium weight, within Gateway box  
Direction: top-to-bottom or left-to-right within the G1-G2-G3 stack  

**F_GW3** (Gateway-internal):  
Source → Target: G2 → G3  
Label: *"no return path"* (must be shown explicitly; this is the data-diode guarantee)  
Style: solid, same weight as F_GW2  
Direction: same as F_GW2  
**Add a small "⊘" or diode symbol on this arrow** to make the unidirectional constraint visually unmistakable. This satisfies NE 177's core requirement.

**F1:**  
Source → Target: G3 → Block S1 (OPC UA Client)  
Label: *OPC UA information (PA-DIM model) — read-only*  
Style: solid, medium weight, crosses Gateway → Lane B boundary  
Direction: left-to-right  
**This is the primary data ingress. It is the only solid arrow crossing from the Gateway to the AEA in the read direction.**

**F2:**  
Source → Target: Block S1 → Block S2 (PA-DIM Harmonizer)  
Label: *normalise signals; apply IEC 61987 IRDIs*  
Style: solid, within AEA  
Direction: top-to-bottom within sense band

---

## Part 5 — Security Gateway: NE 177 upper section

### G1 — Data Retrieval (CPC-side)
Short description inside block: *retrieves from CPC Data Interface via OPC UA subscription*

### G2 — Unidirectional Transfer / Data Diode
Short description inside block: *hardware or logical one-way transfer*  
Note inside block (small, bold): **"unidirectional — no feedback path"**  
This text is required by NE 177's published abstract language and must appear explicitly.

### G3 — Data Provision (psM+O-side)
Short description inside block: *provisions mirrored PA-DIM endpoint for M+O consumption*

---

## Part 6 — Security Gateway: NE 178 lower section (VoR Interface)

### VoR Interface block

Label: **VoR Interface**  
Badge: **NE 178 (2025-03-10)**  
List inside block (small text, three bullets):
- *authentication + authorisation*
- *semantic validation + mapping*
- *audit event emission; non-plant-specific status feedback*

**Design note:** The VoR Interface is a **separate security function** from the NE 177 read-only chain. It must not be labelled as "G4" or presented as a fourth NE 177 module. The boundary between the two sections within the Gateway box should be visually distinct (internal horizontal rule, or a thin colour band as section divider).

### VoR Interface arrows

**F5** ← *This was missing in the prior draft — critical addition*  
Source → Target: Block ACT1 (VoR Request Composer) → VoR Interface  
Label: *VoR request (non-plant-specific, authenticated)*  
Style: **solid, bold weight**, crosses Lane B → Gateway boundary  
Direction: right-to-left (from AEA toward CPC)  
Arrowhead: at VoR Interface  
**This arrow is the only bold solid arrow crossing the Lane B → Gateway boundary and it represents the exclusive write-back initiation path. Its visual weight should distinguish it from read arrows.**

**F6** ← *This was missing in the prior draft — critical addition*  
Source → Target: VoR Interface → Block A3 (CPC Change Handler)  
Label: *mapped + verified change instruction*  
Style: solid, medium weight, crosses Gateway → Lane A boundary  
Direction: left-to-right  
Arrowhead: at CPC Change Handler

**F_VoR_ACK** ← *This was missing in the prior draft — critical addition*  
Source → Target: VoR Interface → Block ACT1 (VoR Request Composer)  
Label: *status: {accepted | rejected | executed | timeout}*  
Subtitle on label: *(non-plant-specific; no CPC architecture disclosed)*  
Style: **dashed**, thinner weight than solid arrows  
Direction: right-to-left (Gateway back to AEA), spatially below F5 to avoid overlap  
**This is the only dashed arrow crossing the Gateway-to-AEA boundary. Its dashed style visually encodes the NE 178 principle that feedback is limited and non-disclosive. It should never be drawn as solid.**

**F3i (corrected)** ← *source was wrong in prior draft*  
Source → Target: VoR Interface → Block DEC_G2 (Deterministic Validators, in Decide band)  
Label: *permitted write scope / OPC UA session roles*  
Style: solid, thin weight, internal to the Gateway-to-AEA direction  
**Rationale for correction:** OPC UA RBAC roles are server-assigned and enforced at the gateway/server boundary, not generated by the OPC UA Client itself. The VoR Interface is the logical enforcement point that knows what the AEA is authorised to request. Sourcing this from the OPC UA Client (as in the prior draft) would imply the client self-reports its own authorisation — architecturally incorrect.

---

## Part 7 — Decide band (detailed)

The decide band is the most complex part of the figure. Organise it as a **left-to-right pipeline** with three columns:

| Column | Contents |
|---|---|
| Left (Knowledge Sources) | AAS Repository; Policy Store |
| Centre (Retrieval + Planning) | Retrieval Guard; RAG / Knowledge Retrieval; Input / Context Guard; LLM Agent / Planner; Tool Guard / Broker |
| Right (Gating) | Output Guard / Schema Checker; Policy-Guard; Deterministic Validators; Human Approval Gate; Guardrail Monitor / Evals |

### Column 1 — Knowledge Sources

**Block DEC_K1 — AAS Repository**  
Label: AAS Repository  
Subtitle: *submodel templates; device configurations; operational constraints*  
Badge: **IEC 63278-1:2023** *(also cite IDTA-01001-3-1-1 v3.1.1 for the metamodel)*  
Note: This is the primary semantic context source. It holds AAS submodel instances for all assets in scope, exposing typed properties with explicit min/max bounds, units, and IEC CDD semantic IDs.

**Block DEC_K2 — Policy Store**  
Label: Policy Store  
Subtitle: *site-specific operational policies; safety interlocks; change approval rules*  
Badge: none (site-specific; not standardised)  
Note: The Policy Store serves **three distinct roles** that require **three separate outbound arrows** (see F3b, F3b', and F_G0_pol below). F3b is soft grounding (context for LLM reasoning); F3b' is hard enforcement (rules for Policy-Guard); F_G0_pol is refusal and sensitive-topic policy for the Input / Context Guard. These roles must not be collapsed into a single path.

### Column 2 — Retrieval and Planning

**Block DEC_R0 — Retrieval Guard**  
Label: Retrieval Guard  
Subtitle: *ACL-aware; provenance-tagged; source-scoped retrieval filter*  
Badge: **OWASP Top 10 for LLM Applications (2025)**  
Note: This deterministic gate sits between semantic stores and the RAG stage. It verifies ACL scope, provenance, and trust classification before any repository material can join the planner context.

**Block DEC_R1 — RAG / Knowledge Retrieval**  
Label: RAG / Knowledge Retrieval  
Subtitle: *AAS-structured retrieval; semantic chunking; IDTA Part 2 API*  
Badge: **IDTA Part 2 API v3.1.1** *(July 2025)*  
Note: Update from v3.1 (used in the previous AAS release). This block retrieves relevant AAS submodel excerpts and policy summaries that form the LLM's reasoning context.

**Block DEC_G0 — Input / Context Guard**  
Label: Input / Context Guard  
Subtitle: *sole planner ingress; classifies, redacts, and refuses before model access*  
Badge: **OWASP Top 10 for LLM Applications (2025)**  
Note: DEC_G0 is the only path through which context reaches the planner. Retrieved text, plant snapshots, and tool observations all pass here for trust classification, redaction, refusal, and deterministic sanitisation.

**Block DEC_R2 — LLM Agent / Planner**  
Label: LLM Agent / Planner  
Subtitle: *tool-using; ReAct reasoning loop (Thought → Act → Observe)*  
Badge: none (implementation-specific)  

Below the LLM block, place a **strip subcomponent**:  
Label: Tool / Skill Interface  
List of tools (small text, comma-separated or pills): `opcua.read` · `aas.query` · `anomaly.detect` · `kpi.compute` · `sim.check`  
**Note on local vs. external tools:** `anomaly.detect`, `kpi.compute`, and `sim.check` are local compute tools requiring no external arrows. Mark them *(local)* in the strip. Only `opcua.read` and `aas.query` require outbound arrows, and both are mediated by the Tool Guard / Broker.

**Block DEC_T0 — Tool Guard / Broker**  
Label: Tool Guard / Broker  
Subtitle: *read-only tool mediation; schema-checked requests; guarded observations*  
Badge: **OWASP Top 10 for LLM Applications (2025)**  
Note: DEC_T0 is the only component allowed to dispatch external tool calls. It enforces allowlists, parameter schemas, read-only guarantees, rate limits, provenance tags, and returns observations through the same deterministic context-guard path used by retrieved content.

### Column 3 — Gating

**Block DEC_G1A — Output Guard / Schema Checker**  
Label: Output Guard / Schema Checker  
Subtitle: *strict machine-readable plan schema; rejects free text*  
Badge: **OWASP Top 10 for LLM Applications (2025)**  
Note: The model may emit only a structured plan object. Deterministic fields such as risk tier, approval requirement, and approval token are computed later and must not be authored by the LLM.

**Block DEC_G1 — Policy-Guard**  
Label: Policy-Guard  
Subtitle: *runtime policy enforcement; rejects non-compliant proposals*  
Badge: **NIST AI RMF 1.0** *(Govern + Measure functions)*  

**Block DEC_G2 — Deterministic Validators**  
Label: Deterministic Validators  
Subtitle (two sub-items inside block):
- *AAS bounds validator (typed property ranges)*
- *OPC UA RBAC validator (session role constraints)*  
Badge: **OPC 10000-18 v1.05.06** *(released 2025-10-31)*

**Block DEC_H1 — Human Approval Gate**  
Label: Human Approval Gate  
Subtitle: *all VoR-bound plans require explicit operator approval*  
Badge: **NIST AI 600-1**  
Note: The approval object binds `plan_hash + snapshot_id + expires_at`. If the approval expires or the current t0 snapshot changes before VoR composition, the plan must return to deterministic validation and cannot proceed on stale state.

**Block DEC_M1 — Guardrail Monitor / Evals**  
Label: Guardrail Monitor / Evals  
Subtitle: *write-once event stream for guardrails, denials, and approvals*  
Badge: **NIST AI 600-1**  
Note: Monitoring is a sidecar, not an actuator. It aggregates pass/reject/approve events from the guardrail layer and forwards them to the audit sink for review and red-team evaluation.

### Decide band arrows

**F3a:**  
Source → Target: AAS Repository → Retrieval Guard  
Label: *AAS submodel retrieval (ACL-gated)*  
Style: solid, thin  

**F3b** (soft grounding):  
Source → Target: Policy Store → Retrieval Guard  
Label: *policy context (soft grounding, ACL-gated)*  
Style: solid, thin  
**Caption note required:** "F3b provides policy summaries as retrieved context for LLM reasoning, but only after deterministic retrieval gating. Hard enforcement is F3b'."

**F_R0_out:**  
Source → Target: Retrieval Guard → RAG  
Label: *approved, provenance-tagged retrieval context*  
Style: solid, medium  

**F3b'** ← *This was missing in the prior draft — critical addition*  
Source → Target: Policy Store → Policy-Guard  
Label: *enforcement rules (hard; non-bypassable)*  
Style: **solid, medium weight** — visually heavier than F3b to encode the distinction  
**Rationale:** Without F3b', the Policy-Guard has no authoritative source to enforce against. Policies reaching the LLM via retrieval (F3b → F3c path) are soft context that the LLM can potentially reason around. The Policy-Guard must hold a direct, non-retrieval-mediated read path to the Policy Store for deterministic enforcement. This is the most important missing arrow in the prior specification.

**F_G0_pol** ← *This was missing in the prior draft — critical addition*  
Source → Target: Policy Store → Input / Context Guard  
Label: *refusal policy / sensitive-topic rules*  
Style: solid, thin  
**Rationale:** DEC_G0 must receive refusal and sensitive-topic policy directly from the Policy Store so refusal logic remains external to the model and independent from retrieved soft context.

**F3c:**  
Source → Target: RAG → Input / Context Guard  
Label: *retrieved context (AAS + policy summaries; untrusted until classified)*  
Style: solid, medium  

**F3d:**  
Source → Target: PA-DIM Harmonizer (Sense band) → Input / Context Guard  
Label: *harmonised plant state (snapshot t0)*  
Style: solid, crosses Sense → Decide band boundary (dashed band separator)  
**The t0 annotation is mandatory** — it makes explicit that the same frozen snapshot used for guarded reasoning input (F3d) and deterministic validation (F3h) is temporally consistent.

**F_G0_out:**  
Source → Target: Input / Context Guard → LLM Agent  
Label: *sanitised, classified planner context*  
Style: solid, medium  
**Architectural rule:** This is the sole planner-context ingress. No retrieved content, plant snapshot, or tool observation may bypass DEC_G0 and reach the planner directly.

**F3e:**  
Source → Target: LLM Agent → Output Guard / Schema Checker  
Label: *raw candidate plan object*  
Style: solid, medium  

**F_G1A_pass:**  
Source → Target: Output Guard / Schema Checker → Policy-Guard  
Label: *schema-valid plan object*  
Style: solid, medium  

**F_G1A_reject:**  
Source → Target: Output Guard / Schema Checker → LLM Agent  
Label: *schema rejection + field/error feedback*  
Style: dashed  
Direction: right-to-left (reverse of F3e)  
Note: Reject payloads must be machine-readable. Risk tier, approval requirement, and approval token are deterministic downstream products, not LLM-authored output fields.

**F3f:**  
Source → Target: Policy-Guard → Deterministic Validators  
Label: *policy-compliant candidates*  
Style: solid, medium  

**F3f_reject** ← *This was missing in the prior draft — significant addition*  
Source → Target: Policy-Guard → LLM Agent  
Label: *rejection + constraint feedback*  
Style: **dashed, thin**, with arrowhead pointing back to LLM  
Direction: right-to-left (reverse of F3e)  
Position: draw below the outbound proposal/schema path to avoid arrow crossing  
**Rationale:** Without this arrow, the Policy-Guard appears to silently discard rejected proposals with no agent-observable consequence. The ReAct loop requires that rejections are observable so the agent can revise its reasoning. This arrow closes the decide loop and makes the architecture reflexive.

**F3g:**  
Source → Target: AAS Repository → Deterministic Validators  
Label: *property bounds + constraints*  
Style: solid, thin  
Note: This arrow crosses from Column 1 to Column 3; route it along the top or bottom edge of the decide band to avoid crossing F3a and F3b.

**F3h:**  
Source → Target: PA-DIM Harmonizer → Deterministic Validators  
Label: *current values snapshot (t₀)*  
Style: solid, thin, crosses Sense → Decide band boundary  
**t₀ annotation here must match F3d** — same frozen snapshot, same time-stamp label.

**F3i (corrected):**  
Source → Target: VoR Interface (Gateway) → Deterministic Validators  
Label: *permitted write scope / OPC UA session roles*  
Style: solid, thin, enters from Gateway boundary  
(See §6 for full rationale of source correction.)

**F_G2_reject** ← *This was missing in the prior draft — critical addition*  
Source → Target: Deterministic Validators → LLM Agent  
Label: *bounds/role rejection + constraint feedback*  
Style: dashed  
Direction: right-to-left, terminating at the planner's bottom rejection port  
Note: This edge makes validator failures planner-visible. A candidate that violates AAS property bounds, the current `t0` snapshot, or VoR-side RBAC scope must not disappear silently; it must return machine-readable constraint feedback so the planner can revise the proposal. This same path also handles failures surfaced after `F_H1_revalidate` forces a stale approval back through deterministic validation.

**F_T1** ← *This was missing in the prior draft — significant addition*  
Source → Target: Tool Guard / Broker → OPC UA Client (Sense band)  
Label: *tool call: opcua.read*  
Style: **dotted**, thin  
Direction: downward from Decide band to Sense band  
Arrowhead: outward only; the observation return is modelled separately through the context guard  
Note: Dotted style (not dashed) distinguishes tool-invoked pulls from passive data pushes. The broker enforces read-only guarantees and request schemas before dispatch.

**F_T2** ← *This was missing in the prior draft — significant addition*  
Source → Target: Tool Guard / Broker → AAS Repository  
Label: *tool call: aas.query*  
Style: dotted, thin, outward only  
Note: Complements F3a by showing that targeted on-demand AAS queries also pass through the same deterministic tool broker.

**F_T0_req:**  
Source → Target: LLM Agent → Tool Guard / Broker  
Label: *tool request (allowlist + schema checked)*  
Style: dotted, thin  
Note: The planner no longer dispatches external tools directly.

**F_T0_obs:**  
Source → Target: Tool Guard / Broker → Input / Context Guard  
Label: *guarded tool observation*  
Style: solid, medium  
Note: Tool results re-enter through the same deterministic input/context guard as retrieved and sensed data.

**F4:**  
Source → Target: Deterministic Validators → Human Approval Gate  
Label: *validated candidate plan (approval pending)*  
Style: solid, medium  

**F_H1_revalidate** ← *This was missing in the prior draft — significant addition*  
Source → Target: Human Approval Gate → Deterministic Validators  
Label: *expired approval / stale snapshot -> revalidate*  
Style: dashed  
Note: This path is taken when `expires_at` lapses or the active `t0` snapshot no longer matches the approval object before VoR composition.

**F_H1_reject** ← *This was missing in the prior draft — significant addition*  
Source → Target: Human Approval Gate → LLM Agent  
Label: *operator rejected -> revise plan*  
Style: dashed  
Note: Human rejection must be observable to the planner so it can revise the proposal rather than silently terminate the loop.

**F_H1_pass:**  
Source → Target: Human Approval Gate → VoR Request Composer  
Label: *approved plan bound to plan_hash + snapshot_id + expires_at*  
Style: solid, medium  

**F_M1_G0** ← *This was missing in the prior draft — significant addition*  
Source → Target: Input / Context Guard → Guardrail Monitor / Evals  
Label: *input/context guard events*  
Style: solid, thin  

**F_M1_R0** ← *This was missing in the prior draft — significant addition*  
Source → Target: Retrieval Guard → Guardrail Monitor / Evals  
Label: *retrieval guard events*  
Style: solid, thin  

**F_M1_T0** ← *This was missing in the prior draft — significant addition*  
Source → Target: Tool Guard / Broker → Guardrail Monitor / Evals  
Label: *tool broker events*  
Style: solid, thin  

**F_M1_G1A** ← *This was missing in the prior draft — significant addition*  
Source → Target: Output Guard / Schema Checker → Guardrail Monitor / Evals  
Label: *schema guard events*  
Style: solid, thin  

**F_M1_H1** ← *This was missing in the prior draft — significant addition*  
Source → Target: Human Approval Gate → Guardrail Monitor / Evals  
Label: *approval gate events*  
Style: solid, thin  
Note: These per-guard streams make the monitor auditable and testable without turning it into an actuation path.

**F_M1_out:**  
Source → Target: Guardrail Monitor / Evals → Audit Log  
Label: *aggregated guardrail audit stream*  
Style: solid, thin  
Note: Guardrail events remain write-once and immutable.

### Mandatory decide-band routing discipline

- Route `F_M1_G0`, `F_M1_R0`, `F_M1_T0`, `F_M1_G1A`, and `F_M1_H1` into a single **guardrail event bus** on the right inside margin of the Decide band. Individual guards should connect via short orthogonal stubs; the bus then drops into `DEC_M1`. Do not draw five long independent monitor arrows across the band.
- Reserve a thin **ceiling bus lane** along the top inside edge of the Decide band. Long cross-column routes such as `F3g` and `F3i` must use this perimeter lane rather than diagonal shortcuts through the planner and guardrail cluster.
- Standardise `DEC_R2` ports to control arrowhead clutter: `F_G0_out` enters at the top, `F3e` and `F_T0_req` leave on the right/top side, and dashed rejection edges (`F_G1A_reject`, `F3f_reject`, `F_G2_reject`, `F_H1_reject`) enter at the bottom.
- Long routes in the Decide band must remain strictly orthogonal. No diagonal connectors are permitted.

---

## Part 8 — Act band (detailed)

### Components

**Block ACT1 — VoR Request Composer**  
Label: VoR Request Composer  
Subtitle: *primary actuation path; composes non-plant-specific VoR request payload*  
Badge: **NE 178 (2025-03-10)**  

**Block ACT2 — KPI Publisher**  
Label: KPI Publisher  
Subtitle: *publish-only; OPC UA PubSub over MQTT*  
Badge: **OPC 10000-14 v1.05.06** *(released 2025-10-31)*  

**Block ACT3 — Audit Log** ← *This was missing in the prior draft*  
Label: Audit Log  
Subtitle: *decision events; VoR request records; policy-guard outcomes*  
Badge: **NE 178 §4 (traceability); NIST AI RMF Govern function**  
**Rationale for addition:** NE 178 explicitly requires traceability as part of the VoR processing chain. The VoR Interface emits audit events, but ACT3 is the durable write-once sink. The prior draft proposed routing decision metadata to the KPI Publisher (F_OPT), which was architecturally incorrect because it would couple operational KPI publication to the actuation audit trail. A dedicated Audit Log block keeps these concerns separated and satisfies both NE 178 traceability requirements and NIST AI RMF auditability obligations cleanly.

### Act band arrows

**F4:**
Source → Target: Deterministic Validators → Human Approval Gate
Label: *validated candidate plan (approval pending)*
Style: solid, medium  

**F_KPI:**  
Source → Target: PA-DIM Harmonizer (Sense band) → KPI Publisher  
Label: *KPI inputs (harmonised signals)*  
Style: solid, thin, crosses Sense → Act band boundary  
**This arrow establishes that KPIs derive from plant telemetry, not from actuation outcomes.** This is the correct primary KPI source, consistent with the principle stated in the prior specification.

**F_AUDIT** ← *replaces the removed F_OPT*  
Source → Target: VoR Request Composer → Audit Log  
Label: *decision event; VoR request record*  
Style: solid, thin  
**This replaces the prior optional F_OPT (VoR Request Composer → KPI Publisher), which conflated operational KPI publication with actuation auditing. The Audit Log is the correct destination for decision metadata.**

---

## Part 9 — Lane C: Central M+O

### Components

**Block C1 — MQTT Broker**  
Label: MQTT Broker  
Badge: **MQTT v5.0**  

**Block C2 — Central Analytics / Historians**  
Label: Central Analytics · Historians · Dashboards  
Badge: none  

### Lane C arrows

**F7a:**  
Source → Target: KPI Publisher (Lane B) → MQTT Broker (Lane C)  
Label: *OPC UA PubSub over MQTT (MQTT mapping, Part 14)*  
Style: solid, medium, crosses Lane B → Lane C boundary  
Direction: left-to-right  

**F7b:**  
Source → Target: MQTT Broker → Central Analytics  
Label: *subscribe / consume*  
Style: solid, medium, within Lane C  

**F7_sub (optional):**  
Source → Target: Central Analytics → MQTT Broker  
Label: *subscribe*  
Style: **dotted** (not dashed — dotted is reserved for optional/subscribe flows; dashed is reserved for status/ack flows)  
Include only if space permits and reviewer context calls for showing the subscribe model explicitly.

---

## Part 10 — Panel B: VoR domain-transition sequence

### 10.1 Layout

Place Panel B as a horizontal ribbon beneath Panel A, spanning the full figure width. Title it:

> **(b) VoR Domain-Transition Sequence (NE 178, 2025)**

### 10.2 Five processing blocks

Draw five rectangular blocks in a left-to-right sequence, connected by solid arrows. Each block represents one NE 178 processing step as operationalised in this architecture. They are **your engineering operationalisation** of the technology-agnostic NE 178 standard — do not present them as verbatim NE 178 section headings.

| Step | Block label | Internal note |
|---|---|---|
| 1 | **Auth & Authorisation** | Verify AEA identity certificate; check write-scope against session role (links to F3i) |
| 2 | **Semantic Verification** | Validate request payload against AAS property types, unit dimensions, and IEC CDD IRDIs |
| 3 | **Mapping** | Translate abstract non-plant-specific parameters into concrete DCS/PLC addresses; resolves asset IDs |
| 4 | **Acceptance** | Gateway / endpoint acceptance only. If any endpoint cannot accept, entire request is rejected (atomicity requirement). AEA-side pre-VoR approval is modelled separately in Panel A and must not be collapsed into this step |
| 5 | **Mapping Verification + Execution** | Verify mapped instruction before write; execute atomically; generate status record for audit log |

### 10.3 Panel B arrows

**PB_F1:** Step 1 → Step 2. Solid, left-to-right.  
**PB_F2:** Step 2 → Step 3. Solid, left-to-right.  
**PB_F3:** Step 3 → Step 4. Solid, left-to-right.  
**PB_F4:** Step 4 → Step 5. Solid, left-to-right.  
No internal labels are required if the block sequence is clear.

**PB_ACK (status return):**  
Source → Target: Step 5 (or the VoR server shown beneath the ribbon) → AEA symbol at left of ribbon  
Label: *status: {accepted | rejected | executed | timeout}*  
Note: *(non-plant-specific; no CPC addresses or asset IDs disclosed)*  
Style: **dashed**, returned below the five-block ribbon (route under, not over, to avoid crossing)  
**This arrow in Panel B corresponds to F_VoR_ACK in Panel A.** The caption must state this correspondence explicitly.

**PB_REJECT (step 4 rejection):**  
Source → Target: Step 4 → rejection output (or dead-end node)  
Label: *rejected → VoR Request Composer notified*  
Style: dashed, pointing downward or diagonally away from the main ribbon  
Position: below the Step 4 block  

### 10.4 Lane annotations on Panel B

Optionally annotate the left and right regions of Panel B ribbon with small zone labels:

- Left margin: *psM+O zone (AEA)*
- Right margin: *CPC zone (DCS/PLC)*
- Boundary indicator: a thin vertical dashed line between Steps 3 and 4 (the mapping step crosses into CPC territory conceptually)

---

## Part 11 — Complete arrow inventory (canonical reference)

This is the definitive, ordered list of all arrows in the figure. Use this as a checklist during artwork production. Arrows marked **[NEW]** were missing from the prior draft.

### Gateway-internal arrows

| ID | Source | Target | Label | Style |
|---|---|---|---|---|
| F_GW1 | CPC Data Interface (A2) | G1 | *OPC UA subscription (PA-DIM topics)* | solid |
| F_GW2 | G1 | G2 | *unidirectional ingress* | solid + diode symbol |
| F_GW3 | G2 | G3 | *"no return path"* | solid + diode symbol |

### Sense arrows

| ID | Source | Target | Label | Style |
|---|---|---|---|---|
| F1 | G3 | OPC UA Client (S1) | *PA-DIM model, read-only* | solid |
| F2 | OPC UA Client (S1) | PA-DIM Harmonizer (S2) | *normalise; assign IRDIs* | solid |

### Decide arrows

| ID | Source | Target | Label | Style | Note |
|---|---|---|---|---|---|
| F3a | AAS Repository | Retrieval Guard | *AAS submodel retrieval (ACL-gated)* | solid thin | |
| F3b | Policy Store | Retrieval Guard | *policy context (soft grounding, ACL-gated)* | solid thin | |
| F3b' **[NEW]** | Policy Store | Policy-Guard | *enforcement rules (hard)* | solid medium | Critical |
| F_G0_pol **[NEW]** | Policy Store | Input / Context Guard | *refusal policy / sensitive-topic rules* | solid thin | Deterministic refusal path |
| F_R0_out **[NEW]** | Retrieval Guard | RAG | *approved, provenance-tagged retrieval context* | solid | |
| F3c | RAG | Input / Context Guard | *retrieved context* | solid | Sole planner ingress path begins here |
| F3d | PA-DIM Harmonizer | Input / Context Guard | *plant state snapshot (t0)* | solid | |
| F_G0_out **[NEW]** | Input / Context Guard | LLM Agent | *sanitised, classified planner context* | solid | Sole planner ingress |
| F3e | LLM Agent | Output Guard / Schema Checker | *raw candidate plan object* | solid | |
| F_G1A_pass **[NEW]** | Output Guard / Schema Checker | Policy-Guard | *schema-valid plan object* | solid | |
| F_G1A_reject **[NEW]** | Output Guard / Schema Checker | LLM Agent | *schema rejection + field/error feedback* | dashed | Loop-back |
| F3f | Policy-Guard | Deterministic Validators | *policy-compliant candidates* | solid | |
| F3f_reject **[NEW]** | Policy-Guard | LLM Agent | *rejection + constraints* | dashed | Loop-back |
| F3g | AAS Repository | Deterministic Validators | *property bounds* | solid thin | |
| F3h | PA-DIM Harmonizer | Deterministic Validators | *current values (t0)* | solid thin | |
| F3i **[CORRECTED]** | VoR Interface | Deterministic Validators | *permitted write scope / roles* | solid thin | Source changed from OPC UA Client |
| F_G2_reject **[NEW]** | Deterministic Validators | LLM Agent | *bounds/role rejection + constraint feedback* | dashed | Loop-back after bounds/RBAC failure |
| F_T0_req **[NEW]** | LLM Agent | Tool Guard / Broker | *tool request* | dotted | Brokered |
| F_T1 **[NEW]** | Tool Guard / Broker | OPC UA Client | *tool call: opcua.read* | dotted | Brokered, read-only |
| F_T2 **[NEW]** | Tool Guard / Broker | AAS Repository | *tool call: aas.query* | dotted | Brokered, read-only |
| F_T0_obs **[NEW]** | Tool Guard / Broker | Input / Context Guard | *guarded tool observation* | solid | Re-entry through deterministic gate |

### Act arrows

| ID | Source | Target | Label | Style | Note |
|---|---|---|---|---|---|
| F4 | Deterministic Validators | Human Approval Gate | *validated candidate plan (approval pending)* | solid | |
| F_H1_revalidate **[NEW]** | Human Approval Gate | Deterministic Validators | *expired approval / stale snapshot -> revalidate* | dashed | Freshness loop |
| F_H1_reject **[NEW]** | Human Approval Gate | LLM Agent | *operator rejected -> revise plan* | dashed | Planner-visible rejection |
| F_H1_pass **[NEW]** | Human Approval Gate | VoR Request Composer | *approved plan bound to plan_hash + snapshot_id + expires_at* | solid | Final pre-VoR gate |
| F_M1_G0 **[NEW]** | Input / Context Guard | Guardrail Monitor / Evals | *input/context guard events* | solid thin | |
| F_M1_R0 **[NEW]** | Retrieval Guard | Guardrail Monitor / Evals | *retrieval guard events* | solid thin | |
| F_M1_T0 **[NEW]** | Tool Guard / Broker | Guardrail Monitor / Evals | *tool broker events* | solid thin | |
| F_M1_G1A **[NEW]** | Output Guard / Schema Checker | Guardrail Monitor / Evals | *schema guard events* | solid thin | |
| F_M1_H1 **[NEW]** | Human Approval Gate | Guardrail Monitor / Evals | *approval gate events* | solid thin | |
| F_KPI | PA-DIM Harmonizer | KPI Publisher | *KPI inputs (harmonised signals)* | solid thin | |
| F_AUDIT **[NEW]** | VoR Request Composer | Audit Log | *decision event; VoR record* | solid thin | Replaces removed F_OPT |
| F_M1_out **[NEW]** | Guardrail Monitor / Evals | Audit Log | *guardrail audit stream* | solid thin | Immutable sidecar feed |

### Write-back arrows

| ID | Source | Target | Label | Style | Note |
|---|---|---|---|---|---|
| F5 **[NEW]** | VoR Request Composer | VoR Interface | *VoR request (non-plant-specific)* | **solid bold** | Critical; exclusive write path |
| F6 **[NEW]** | VoR Interface | CPC Change Handler (A3) | *mapped + verified change instruction* | **solid bold** | |
| F_VoR_ACK **[NEW]** | VoR Interface | VoR Request Composer | *status: accepted\|rejected\|executed\|timeout* | **dashed** | Non-plant-specific feedback |
| F_CPC_INT (optional) | CPC Change Handler (A3) | CPC System (A1) | *execute verified change* | solid medium | Within Lane A |

### Northbound arrows

| ID | Source | Target | Label | Style |
|---|---|---|---|---|
| F7a | KPI Publisher | MQTT Broker | *OPC UA PubSub over MQTT* | solid thin |
| F7b | MQTT Broker | Central Analytics | *subscribe/consume* | solid thin |
| F7_sub (optional) | Central Analytics | MQTT Broker | *subscribe* | dotted |

### Panel B sequence arrows

| ID | Source | Target | Label | Style | Note |
|---|---|---|---|---|---|
| PB_F1 | PB1 | PB2 | *1 -> 2* | solid medium | Auth to semantic verification |
| PB_F2 | PB2 | PB3 | *2 -> 3* | solid medium | Semantic verification to mapping |
| PB_F3 | PB3 | PB4 | *3 -> 4* | solid medium | Mapping to acceptance |
| PB_F4 | PB4 | PB5 | *4 -> 5* | solid medium | Acceptance to mapping verification + execution |
| PB_ACK | PB5 | PB_AEA | *status: accepted\|rejected\|executed\|timeout* | dashed | Panel B counterpart of F_VoR_ACK |
| PB_REJECT | PB4 | PB_REJECT_OUT | *rejected -> VoR Request Composer notified* | dashed | Acceptance rejection branch |

**Removed from prior draft:**  
~~F_OPT: VoR Request Composer → KPI Publisher~~ — removed; replaced by F_AUDIT to Audit Log. This arrow conflated KPI publication with actuation audit trail.

---

## Part 12 — Visual encoding rules (arrow styles)

The figure uses five distinct arrow styles. Each style must be used **consistently and exclusively** for its designated semantic. Mixing styles degrades the figure's argumentative clarity.

| Style | Appearance | Semantic meaning | Arrows using this style |
|---|---|---|---|
| **Solid bold** | 1.5 pt solid | Primary, safety-relevant, exclusive write corridor | F5, F6 |
| **Solid medium** | 1.0 pt solid | Standard data flow, in-scope | F_GW1-3, F1, F3b', F_R0_out, F3c, F3d, F_G0_out, F3e, F_G1A_pass, F3f, F_T0_obs, F4, F_H1_pass, F_CPC_INT, PB_F1-4 |
| **Solid thin** | 0.5 pt solid | Secondary/supporting data flow and northbound telemetry | F2, F3a, F3b, F_G0_pol, F3g, F3h, F3i, F_M1_G0/R0/T0/G1A/H1/out, F_KPI, F_AUDIT, F7a, F7b |
| **Dashed** | 1.0 pt dashed (4pt dash, 2pt gap) | Status, feedback, rejection, acknowledgement | F_G1A_reject, F3f_reject, F_G2_reject, F_H1_revalidate, F_H1_reject, F_VoR_ACK, PB_ACK, PB_REJECT |
| **Dotted** | 0.75 pt dotted | Agent-initiated tool calls; optional subscription | F_T0_req, F_T1, F_T2, F7_sub |

**Never use dashed for subscribe flows** (use dotted). **Never use dotted for status/ack flows** (use dashed). This three-way distinction (solid / dashed / dotted) is sufficient to encode all semantic categories without additional colour coding.
For final artwork, dotted strokes must not drop below **0.75 pt** at print scale. If reduction testing weakens legibility, increase them to **1.0 pt** rather than thinning them further.

---

## Part 13 — Badge and standards version reference

All badges placed inside component blocks must use these exact version strings. These values were verified against primary sources during the March 21, 2026 review pass.

| Component | Badge text | Standard | Version note |
|---|---|---|---|
| PA-DIM Harmonizer | OPC 30081 PA-DIM v1.02 | OPC Foundation / PI / NAMUR | Released 2026-01-24; replaces v1.01 |
| AAS Repository | IEC 63278-1:2023 | IEC / IDTA | Also cite IDTA-01001-3-1-1 v3.1.1 (July 2025) in references |
| RAG / Knowledge Retrieval | IDTA Part 2 API v3.1.1 | IDTA | July 2025; previous version 3.1 |
| Policy-Guard | NIST AI RMF 1.0 | NIST | NIST AI 100-1, January 2023 |
| Deterministic Validators | OPC 10000-18 v1.05.06 | OPC Foundation | Released 2025-10-31 |
| VoR Request Composer | NE 178 (2025-03-10) | NAMUR | 63 pages; full document required for §2 analysis |
| VoR Interface (Gateway) | NE 178 (2025-03-10) | NAMUR | Same document; cite for both blocks |
| KPI Publisher | OPC 10000-14 v1.05.06 | OPC Foundation | Released 2025-10-31; Part 14 = PubSub |
| MQTT Broker | MQTT v5.0 | OASIS | OASIS Standard 2019; ISO/IEC 20922:2016 for v3.1.1 |
| NE 177 read-only chain | NE 177 (2021-04-08) | NAMUR | NAMUR Open Architecture – NOA Security Zones and Security Gateway |

---

## Part 14 — What the figure caption must cover

Journal figures should be self-contained with their caption. The caption for this figure must address the following, in order:

1. **One-sentence figure title** describing what the figure depicts, not what it shows (e.g., "Architecture of the Autonomous Edge Agent (AEA) within the NOA M+O domain.")

2. **Panel A description**: Identify the three swimlanes and the Security Gateway; note that all agent components reside in Lane B (psM+O), never in Lane A (CPC).

3. **Arrow style legend**: Define all five arrow styles (solid bold, solid medium, solid thin, dashed, dotted) and their semantic meanings. This must appear in the caption, not inside the figure (per Nature and IEEE guidelines).

4. **F3b / F3b' distinction**: "The Policy Store feeds RAG as soft grounding context (F3b) and the Policy-Guard as hard enforcement rules (F3b'); the LLM receives policy summaries via retrieved context but cannot bypass the Policy-Guard validation step."

5. **t₀ note**: "F3d and F3h both source from the same time-stamped PA-DIM snapshot taken at the start of each decision cycle (t₀), ensuring temporal consistency between the LLM's reasoning state and the validator's reference values."

6. **Panel B correspondence**: "Panel (b) elaborates the five-step VoR domain-transition protocol (F5 in panel (a)); the dashed return arrow (PB_ACK) corresponds to F_VoR_ACK in panel (a)."

7. **Version currency statement**: "Standards badges reflect versions verified in the March 21, 2026 review: PA-DIM v1.02 (2026-01-24), IDTA Part 1 and Part 2 v3.1.1 (July 2025), OPC UA Parts 14 and 18 v1.05.06 (2025-10-31), NE 177 (2021-04-08), NE 178 (2025-03-10)."

---

## Part 15 — Operational clarifications required in the manuscript

The figure is only defensible if the manuscript states the following operating assumptions explicitly:

1. **Define stale `t0` operationally.** State the approval-expiry rule and the freshness tolerance for the bound snapshot, for example exact `snapshot_id` matching, variable-level deadbands, or an allowed drift envelope for steady-state windows. Without this, `F_H1_revalidate` can look like an infinite loop in fast-changing plants.

2. **Bound replanning loops.** The planner must enforce a local `max_iterations` circuit breaker spanning `F_G1A_reject`, `F3f_reject`, `F_G2_reject`, and `F_H1_reject`. Once the bound is reached, the cycle aborts, records the failure in `ACT3`, and emits no VoR request.

3. **State the actuation-confirmation model.** `F_VoR_ACK` returns only to `ACT1`; `ACT3` receives the durable audit trail via `F_AUDIT` and `F_M1_out`. The LLM Agent does **not** receive direct success/failure confirmation. The manuscript must say that actuation outcome is inferred from the next PA-DIM cycle (`t1`) rather than from a planner-visible acknowledgement, which prevents the model from hallucinating execution success before the plant confirms it.

---

## Part 16 — What to exclude from the figure

Do not place any of the following inside the figure artwork:

- Reference source names or journal names (belongs in reference list)
- Version history notes or change logs
- Performance metrics (latency, jitter, energy — belong in Results section)
- Explanatory paragraphs or multi-sentence notes
- Acronym expansion lists
- Colour-coded risk levels or SIL numbers (this figure is an architecture figure, not a risk matrix)
- The word "proposed" (implies the architecture is not yet defined; use descriptive labels only)

---

## Part 17 — Common reviewer objections this figure pre-empts

| Likely reviewer question | How this figure answers it |
|---|---|
| "How does the agent write back without violating the data diode?" | F5 → VoR Interface → F6 is a separate write-back channel entirely distinct from the G1-G2-G3 read chain; the diode symbol on F_GW3 makes this visually explicit |
| "What prevents the LLM from generating unsafe set-points?" | F3b' (hard enforcement) + F3f (policy-compliant candidates only reach validators) + F3g (AAS bounds validation) form three independent barriers before F4 reaches VoR |
| "Is the KPI stream independent of whether actuation occurs?" | F_KPI sources from PA-DIM Harmonizer (telemetry), not from VoR Request Composer; Audit Log (F_AUDIT) captures actuation decisions separately |
| "What happens when the Policy-Guard rejects a proposal?" | F3f_reject closes the loop back to the LLM Agent, enabling plan revision |
| "What happens when deterministic validators reject a proposal or a stale approval fails revalidation?" | F_G2_reject returns bounds / role rejection feedback to the LLM Agent, so validator failures remain planner-visible even after `F_H1_revalidate` |
| "Where is the RBAC enforcement point for write-back?" | F3i sources from VoR Interface (corrected), which holds OPC UA session roles; the OPC UA Client cannot self-assert write permissions |
| "How does the figure align with NE 175's three information domains?" | The three swimlane titles map directly: Lane A = CPC, Lane B = psM+O, Lane C = central M+O |

---

*End of specification. This document supersedes all prior figure instructions. All changes from the prior draft are marked [NEW] or [CORRECTED] in the arrow inventory (Part 11).*
