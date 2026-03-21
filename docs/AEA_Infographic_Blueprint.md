# AEA Architecture Infographic Blueprint

### 1. DATA SYNTHESIS & EXACT COPY
**Title & Subtitle:**

**Option 1**
- **One-Way Eyes, Gated Hands**
- *How the AEA reads CPC, reasons at the edge, and writes back only through a verified VoR corridor*

**Option 2**
- **The Safe Edge Agent**
- *A clear map of the AEA architecture, its guardrails, and the single controlled path into CPC*

**The "Hook":**
- **Exactly 1** exclusive writeback corridor can reach CPC.
- **Exactly 1** dashed status path can return.
- **Exactly 0** direct agent writes bypass the VoR interface.

**The Pedagogical Analogy:**
- **Like an autopilot behind glass:** it can read cockpit instruments, ask a certified dispatcher to relay a change, but it never touches the controls directly.

**Data Modules (Exact Copy):**

**1. Context**
- **Canon** 36 nodes. 51 edges.
- **Claims** 6 architecture claims.
- **Authority** 17 standards anchors.
- **Boundary** Agent lives in psM+O, not CPC.

**2. Sense Path**
- **Ingress** G1 -> G2 -> G3 only.
- **Guarantee** Diode-style read chain. *No return path.*
- **Snapshot** PA-DIM v1.02 released **2026-01-24**.
- **Rule** CPC telemetry enters read-only.

**3. Decide Guardrails**
- **Stack** Retrieval. Context. Schema. Policy. Validators. Human approval.
- **Grounding** AAS Part 1 and Part 2 run at **v3.1.1**.
- **Update** Metamodel and API references refreshed in **July 2025**.
- **Principle** Safety controls stay deterministic and external to the model.

**4. Actuation / VoR**
- **Only write path** F5 -> VoR Interface -> F6.
- **Protocol** **5** VoR steps: Auth -> Semantic check -> Mapping -> Acceptance -> Execute.
- **Feedback** Dashed ACK returns *accepted | rejected | executed | timeout*.
- **Guardrail** No alternate direct write channel into CPC.

**5. Telemetry + Standards**
- **Split** KPI publication is publish-only. Audit is separate.
- **Standard note** NE 178 published **2025-03-10**.
- **PubSub note** OPC UA Part 14 and Part 18 hit **v1.05.06** on **2025-10-31**.
- **AI safety note** NIST AI 600-1 (July 2024): **13 risks**, **400+ actions**, **2,500** contributors. OWASP LLM Top 10 (2025): **600+** contributors, **18+** countries, **130+** companies, nearly **8,000** active members.

### 2. VISUAL ARCHITECTURE & WIREFRAME
**Layout Strategy:**
- **Portrait modular grid** with 3 vertical zones and a bottom authority strip.
- Eye starts **top-left** on the title and hook.
- Eye moves **top-right** to the analogy and promise.
- Eye drops through the **center gateway spine** to see the read/write separation.
- Eye then scans **left -> center -> right** across Sense, Decide, and Act.
- Eye finishes on the **bottom standards strip** for evidence, dates, and governance context.

**Section Mapping:**
- **Top band:** Title, subtitle, hook, analogy.
- **Upper-left quadrant:** **Context** module with the 36/51/6/17 macro counts.
- **Mid-left column:** **Sense Path** module wrapped around the G1 -> G2 -> G3 ingress chain.
- **Center focal zone:** **Decide Guardrails** as the densest cluster, with guardrails stacked around the planner.
- **Mid-right column:** **Actuation / VoR** as a five-step ribbon aimed toward CPC.
- **Bottom full-width strip:** **Telemetry + Standards** with KPI-vs-audit split on the left and release/governance timeline on the right.

### 3. TECHNICAL DESIGN & AESTHETIC BLUEPRINT
**Visual Motif:**
- **Editorial industrial systems poster**
- Flat-vector minimalism
- Thin technical linework
- Bold accent reserved for actuation risk points and the exclusive write corridor

**Color Palette:**
- **Background:** `#F5F1E8`
- **Primary:** `#123043`
- **Secondary:** `#2E6F73`
- **Accent:** `#F28C28`
- **Text:** `#111827`
- **Why it works:** warm paper softens complexity for non-experts, blue-teal signals engineering trust and system clarity, orange isolates the single risky corridor so the actuation story reads instantly.

**Typography:**
- **Headers:** `Space Grotesk`
- **Body:** `IBM Plex Sans`
- **Technical data / dates / edge IDs:** `IBM Plex Mono`

**Data Visualization Specs:**
- **1 bold path / 1 dashed ACK / 0 direct writes:** highlighted **Sankey-style corridor** centered on the gateway, with the forbidden direct-write route shown as a ghosted blocked line.
- **36 nodes / 51 edges:** **annotated node-link density map** with lane shading and local count callouts.
- **6 architecture claims:** **radial claim wheel** with each claim tied to its dominant lane or corridor.
- **17 standards anchors:** **domain-grouped dot matrix** arranged by NOA / OPC / IDTA / AI safety families.
- **PA-DIM v1.02 released 2026-01-24:** left rung of a **dual release ladder** with a date chip and small “replaces prior harmonizer baseline” note.
- **AAS Part 1 + Part 2 v3.1.1 / July 2025:** right rung of the **dual release ladder** with paired metamodel/API capsules and both capsules accented.
- **5 VoR steps:** **numbered sequence ribbon** with rectangular stations and a dashed rejection/ACK branch.
- **NE 178 and OPC UA 1.05.06 release dates:** **labeled timeline footer** with compact date pins.
- **NIST + OWASP microdata:** **compact lollipop callouts** in the footer, split into “governance” and “community scale” columns.
