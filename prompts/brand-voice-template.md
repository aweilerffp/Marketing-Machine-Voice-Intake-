# Brand Voice Deliverable Template

<!-- 
  This template tells the extraction prompt what insights to surface for each of the
  six theme sections. The fields listed here map directly to the Phase 1 prompt's
  deliverable expectations (see AI_Prompt_Templates_Consolidated for the downstream
  polish step that consumes this extraction).
-->

## 1. Voice Personality

A 2-3 sentence summary capturing how this brand sounds. Specific and vivid, not generic.

Extract:
- **Personality summary** — 2-3 vivid sentences in plain language
- **Personality traits** — 3-5 traits the founder explicitly named (e.g. "steady," "plain-spoken," "dry humor")
- **Brand-as-a-person metaphor** — how the founder described the brand if it "walked into a room"
- **What the brand should never sound like** — the "anti-you" the founder described

## 2. Core Values in Action

For each core value the founder named: the value itself, plus how it shows up in observable behavior or content. Not abstract — concrete proof points.

Extract:
- **Named values** — the actual values the founder listed (the real ones, not wall art)
- **Value-in-action** — for each value, a specific example of how it manifests in client work or team behavior
- **Mission statement** — the founder's answer to "why does this company exist"
- **Proof points** — specific client stories or results that demonstrate values

## 3. Content Pillars

3-5 themes the brand should consistently talk about. Pulled from what the founder naturally gravitated toward in conversation.

Extract:
- **Pillar themes** — 3-5 topic areas (e.g. "Tech-as-infrastructure," "Operator empathy," "Quiet competence")
- **Why this pillar** — brief rationale tying the pillar to something the founder said
- **Representative angles** — 1-2 specific content angles per pillar

## 4. Tone & Style Cheat Sheet

The specific stylistic rules for how the brand communicates.

Extract:
- **Formality rating** — the founder's 1-10 rating (and any nuance, e.g. "3 on social, 5 in proposals")
- **Contractions** — yes/no and any notes (e.g. "always — we are sounds like a press release")
- **Loved words/phrases** — phrases the founder explicitly loves using (captured as exact words)
- **Banned words/phrases** — phrases the founder wants to avoid (captured as exact words, also goes in explicit_dont)
- **Audience address** — how the brand refers to its audience ("you," "your team," etc.)
- **Technical depth** — jargon-heavy, plain English, or middle ground
- **Slang/casual language** — any on-brand casual language or industry phrases the founder mentioned

## 5. Scenario Playbook

How the brand voice adapts to different communication scenarios. The Phase 1 prompt expects all four scenarios below.

Extract ONE insight per scenario, using these exact labels:
- **"Announcing a new feature or service"** — the founder's described approach
- **"Apologizing for a service disruption"** — the founder's described approach
- **"Explaining something complex to a non-technical prospect"** — the founder's described approach
- **"Celebrating a client win"** — the founder's described approach

Each `value` should be a short description of the approach (2-3 sentences), ideally with the founder's own phrasing. `evidence` should point to the specific transcript section.

## 6. Do vs Don't

Concrete pairs showing on-brand vs off-brand. Phase 1 expects at least 3 pairs.

Extract:
- **Do/Don't pairs** — each insight has `label: "Do vs Don't: [topic]"` and `value` describing both sides. At least 3 pairs.
- **Admired brands** — 2-3 brands whose voice the founder admires, with reason
- **Competitor differentiation** — how the founder wants to sound different from competitors
- **Client voice echoes** — what the founder's best clients say about them (in clients' words)
