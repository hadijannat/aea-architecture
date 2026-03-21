# AEA Panel A Elements and Connections

Generated from `src/graph/spec/architecture.graph.json`. Scope is `Panel A` only: `34` architecture elements and `44` architecture connections.

## Elements

| id | element | subtitle | description |
| --- | --- | --- | --- |
| LANE_A | Lane A | Core Process Control (CPC / OT) | CPC lane holding the DCS or PLC system, the read-only data interface, and the change handler that receives VoR-approved write instructions. |
| LANE_B | Lane B | Plant-specific M+O (psM+O edge) | Plant-specific Monitoring and Optimization lane containing the AEA, gateway-adjacent consumption, decision logic, and VoR request composition. |
| LANE_C | Lane C | Central M+O (off-prem) | Central analytics and historian lane consuming publish-only KPI telemetry over MQTT. |
| GW | NOA Security Gateway | NE 177 / NE 178 | Boundary container that separates CPC from psM+O. The upper section is the NE 177 read-only chain and the lower section is the NE 178 VoR interface. |
| AEA | Autonomous Edge Agent (AEA) | psM+O edge node | Large container grouping the Sense, Decide, and Act bands on the plant-specific M+O edge node. |
| BAND_SENSE | Sense | Data acquisition and normalisation | Sense band for OPC UA ingestion, PA-DIM normalization, and the canonical t0 telemetry snapshot. |
| BAND_DECIDE | Decide | Reasoning, retrieval, and gating | Decide band for semantic retrieval, LLM planning, policy enforcement, and deterministic validation. |
| BAND_ACT | Act | Validated actuation and KPI publication | Act band for VoR request composition, publish-only KPI emission, and audit records. |
| A1 | CPC System | DCS / PLC | Core process control system that remains SIL-rated and independent from the M+O agent. |
| A2 | CPC Data Interface | OPC UA Server · PA-DIM information model | Read-only sensing endpoint exposing CPC telemetry in the PA-DIM model to the security gateway. |
| A3 | CPC Change Handler | Executes or queues VoR-accepted changes | Exclusive write target for VoR-approved mapped change instructions. |
| G1 | G1 | Data Retrieval | CPC-side retrieval module that subscribes to the CPC Data Interface. |
| G2 | G2 | Unidirectional Transfer / Data Diode | One-way transfer module enforcing the absence of any feedback path from psM+O to CPC for sensing. |
| G3 | G3 | Data Provision | psM+O-side provision module exposing a mirrored PA-DIM endpoint to the AEA. |
| VOI | VoR Interface | NE 178 interface | Separate security function handling authentication, authorisation, semantic validation, mapping, audit logging, and non-plant-specific status feedback for write-back. |
| S1 | OPC UA Client | Read-only session · subscribes to PA-DIM nodes | AEA-side client consuming the mirrored PA-DIM endpoint through a read-only session role. |
| S2 | PA-DIM Harmonizer | Normalises signals; assigns IEC 61987 IRDIs; time-stamps feature vector (t0) | Normalization block converting heterogeneous device signals into a harmonized PA-DIM-aligned snapshot with shared t0 semantics. |
| DEC_K1 | AAS Repository | Submodel templates; device configurations; operational constraints | Primary semantic context source containing typed AAS submodels, units, bounds, and operational constraints. |
| DEC_K2 | Policy Store | Site-specific operational policies; safety interlocks; change approval rules | Policy source with separate retrieval, refusal, and hard-enforcement outbound paths. |
| DEC_R0 | Retrieval Guard | ACL-aware; provenance-tagged; source-scoped retrieval filter | Deterministic access-control gate between the semantic stores and the retrieval stage. |
| DEC_R1 | RAG / Knowledge Retrieval | AAS-structured retrieval; semantic chunking; IDTA Part 2 API | Retrieval stage collecting AAS excerpts and policy summaries for the guarded planner context. |
| DEC_G0 | Input / Context Guard | Sole planner ingress; classifies, redacts, and refuses before model access | Deterministic input gate for retrieved text, plant snapshots, and tool observations before any model sees them. |
| DEC_R2 | LLM Agent / Planner | Tool-using; ReAct reasoning loop | Planner that consumes only guarded context, proposes structured plans, and reacts to deterministic schema or policy rejections. |
| DEC_T0 | Tool Guard / Broker | Read-only tool mediation; schema-checked requests; guarded observations | Deterministic broker that is solely responsible for dispatching external tool calls and returning observations through the guarded context path. |
| DEC_G1A | Output Guard / Schema Checker | Strict plan schema; deterministic fields remain external | Schema-validation gate that accepts only a machine-readable plan object and rejects free text or unsupported fields before policy evaluation. |
| DEC_G1 | Policy-Guard | Runtime policy enforcement; rejects non-compliant proposals | Hard policy enforcement stage that consumes direct policy rules and emits either compliant candidates or rejection feedback. |
| DEC_G2 | Deterministic Validators | AAS bounds validator + OPC UA RBAC validator | Deterministic stage validating typed bounds, current values, permitted write scope, plan hash, and approval freshness before any VoR request is composed. |
| DEC_H1 | Human Approval Gate | All VoR-bound plans require explicit operator approval | Human-in-the-loop gate that approves a specific plan hash against a specific snapshot and expiry window before VoR composition. |
| DEC_M1 | Guardrail Monitor / Evals | Write-once event stream for guardrails, denials, and approvals | Sidecar monitor that aggregates guardrail pass, reject, deny, and approval events for audit and evaluation. |
| ACT1 | VoR Request Composer | Primary actuation path; composes non-plant-specific VoR request payload | AEA-side actuation block that translates the approved plan into the non-plant-specific VoR request payload. |
| ACT2 | KPI Publisher | Publish-only; OPC UA PubSub over MQTT | Publish-only northbound telemetry publisher decoupled from actuation. |
| ACT3 | Audit Log | Decision events; VoR request records; guardrail outcomes | Dedicated audit sink for decision, guardrail, and VoR records, separated from KPI publication. |
| C1 | MQTT Broker | MQTT v5.0 | Central messaging broker receiving publish-only KPI messages from the AEA. |
| C2 | Central Analytics · Historians · Dashboards | Subscribe / consume | Central M+O consumers subscribing to KPI streams for analytics, historian ingestion, and dashboarding. |

## Connections

`flow direction` is the rendered orientation from the manifest: `left-to-right`, `right-to-left`, `top-to-bottom`, or `bottom-to-top`.

| id | source | target | flow direction | description |
| --- | --- | --- | --- | --- |
| F_GW1 | CPC Data Interface | G1 | left-to-right | OPC UA subscription (PA-DIM topics) |
| F_GW2 | G1 | G2 | top-to-bottom | unidirectional ingress |
| F_GW3 | G2 | G3 | top-to-bottom | "no return path" — Rendered with a diode symbol to make the unidirectional guarantee visually explicit. |
| F1 | G3 | OPC UA Client | left-to-right | PA-DIM model, read-only |
| F2 | OPC UA Client | PA-DIM Harmonizer | left-to-right | normalise signals; apply IEC 61987 IRDIs |
| F3a | AAS Repository | Retrieval Guard | left-to-right | AAS submodel retrieval (ACL-gated) |
| F3b | Policy Store | Retrieval Guard | left-to-right | policy context (soft grounding, ACL-gated) |
| F_R0_out | Retrieval Guard | RAG / Knowledge Retrieval | left-to-right | approved, provenance-tagged retrieval context |
| F3b' | Policy Store | Policy-Guard | left-to-right | enforcement rules (hard; non-bypassable) |
| F3c | RAG / Knowledge Retrieval | Input / Context Guard | left-to-right | retrieved context (untrusted until classified) — AAS + policy summaries |
| F3d | PA-DIM Harmonizer | Input / Context Guard | top-to-bottom | harmonised plant state (snapshot t0) to guarded ingress |
| F_G0_pol | Policy Store | Input / Context Guard | left-to-right | refusal policy / sensitive-topic rules |
| F_G0_out | Input / Context Guard | LLM Agent / Planner | left-to-right | sanitised, classified planner context |
| F3e | LLM Agent / Planner | Output Guard / Schema Checker | left-to-right | raw candidate plan object |
| F_G1A_pass | Output Guard / Schema Checker | Policy-Guard | top-to-bottom | schema-valid plan object |
| F_G1A_reject | Output Guard / Schema Checker | LLM Agent / Planner | right-to-left | schema rejection + field/error feedback |
| F3f | Policy-Guard | Deterministic Validators | left-to-right | policy-compliant candidates |
| F3f_reject | Policy-Guard | LLM Agent / Planner | right-to-left | rejection + constraint feedback |
| F3g | AAS Repository | Deterministic Validators | left-to-right | property bounds + constraints |
| F3h | PA-DIM Harmonizer | Deterministic Validators | top-to-bottom | current values snapshot (t0) |
| F3i | VoR Interface | Deterministic Validators | left-to-right | permitted write scope / OPC UA session roles |
| F_T1 | Tool Guard / Broker | OPC UA Client | bottom-to-top | tool call: opcua.read — Observation return traverses F_T0_obs -> F_G0_out |
| F_T2 | Tool Guard / Broker | AAS Repository | bottom-to-top | tool call: aas.query — Observation return traverses F_T0_obs -> F_G0_out |
| F_T0_req | LLM Agent / Planner | Tool Guard / Broker | bottom-to-top | tool request (allowlist + schema checked) |
| F_T0_obs | Tool Guard / Broker | Input / Context Guard | top-to-bottom | guarded tool observation |
| F4 | Deterministic Validators | Human Approval Gate | left-to-right | validated candidate plan (approval pending) |
| F_H1_revalidate | Human Approval Gate | Deterministic Validators | bottom-to-top | expired approval / stale snapshot -> revalidate |
| F_H1_reject | Human Approval Gate | LLM Agent / Planner | right-to-left | operator rejected -> revise plan |
| F_H1_pass | Human Approval Gate | VoR Request Composer | left-to-right | approved plan bound to plan_hash + snapshot_id + expires_at |
| F_M1_G0 | Input / Context Guard | Guardrail Monitor / Evals | bottom-to-top | input/context guard events |
| F_M1_R0 | Retrieval Guard | Guardrail Monitor / Evals | bottom-to-top | retrieval guard events |
| F_M1_T0 | Tool Guard / Broker | Guardrail Monitor / Evals | bottom-to-top | tool broker events |
| F_M1_G1A | Output Guard / Schema Checker | Guardrail Monitor / Evals | bottom-to-top | schema guard events |
| F_M1_H1 | Human Approval Gate | Guardrail Monitor / Evals | bottom-to-top | approval gate events |
| F_M1_out | Guardrail Monitor / Evals | Audit Log | left-to-right | guardrail audit stream |
| F_KPI | PA-DIM Harmonizer | KPI Publisher | bottom-to-top | KPI inputs (harmonised signals) |
| F_AUDIT | VoR Request Composer | Audit Log | left-to-right | decision event; VoR request record |
| F5 | VoR Request Composer | VoR Interface | right-to-left | VoR request (non-plant-specific, authenticated) |
| F6 | VoR Interface | CPC Change Handler | right-to-left | mapped + verified change instruction |
| F_VoR_ACK | VoR Interface | VoR Request Composer | right-to-left | status: accepted \| rejected \| executed — non-plant-specific; no CPC architecture disclosed |
| F_CPC_INT | CPC Change Handler | CPC System | bottom-to-top | execute verified change |
| F7a | KPI Publisher | MQTT Broker | left-to-right | OPC UA PubSub over MQTT — MQTT mapping, Part 14 |
| F7b | MQTT Broker | Central Analytics · Historians · Dashboards | left-to-right | subscribe / consume |
| F7_sub | Central Analytics · Historians · Dashboards | MQTT Broker | right-to-left | subscribe |
