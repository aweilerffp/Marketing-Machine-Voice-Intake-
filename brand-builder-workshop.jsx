import { useState, useRef, useEffect, useCallback } from "react";

const ACCENT = "#3B82F6";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const BG = "#0F172A";
const CARD = "#1E293B";
const CARD2 = "#293548";
const BORDER = "#334155";
const TEXT = "#E2E8F0";
const MUTED = "#94A3B8";
const DIM = "#64748B";
const INPUT_BG = "#0F172A";
const MODEL = "claude-sonnet-4-20250514";
const SK = "brand-workshop-session";

const PHASES = ["WELCOME","SA_INT","SA_GEN","SA_REV","SB_INT","SB_GEN","SB_REV","SC_INT","SC_GEN","SC_REV","COMPLETE"];
const SMETA = {
  A: { label: "Brand Voice", color: ACCENT, icon: "🎤", qTarget: "~15", deliv: "Brand Voice Guide" },
  B: { label: "Ideal Customer", color: GREEN, icon: "🎯", qTarget: "~12", deliv: "ICP Profile" },
  C: { label: "Channels & Marketing", color: AMBER, icon: "📡", qTarget: "~8", deliv: "Channel Strategy & Calendar" },
};

const IBASE = `You are conducting a Brand Voice & ICP discovery interview for a B2B company. You're an expert facilitator — warm, direct, and genuinely curious.

RULES:
1. Ask ONE question at a time. Never bundle questions.
2. When they give a short or vague answer, push deeper with a specific follow-up. Do this up to 2-3 times per topic before moving on.
3. Reference their previous answers to make follow-ups feel natural.
4. Be conversational. React briefly to what they say (1 sentence max), then ask.
5. NEVER use bullet points or numbered lists.
6. Keep messages short — 2-4 sentences max.
7. Track internally what topics you've covered. When ALL required topics are covered with sufficient depth, say exactly: [SECTION_COMPLETE]
8. Do NOT say [SECTION_COMPLETE] until you have genuinely covered all required topics.`;

const PROMPTS = {
  A: `${IBASE}

YOU ARE IN SECTION A: BRAND VOICE DISCOVERY. Cover ALL these topics (flexible order):

BASICS: What the company does (elevator pitch), core services/products, core values (real ones, not wall ones), mission — why this company exists, specific results/case studies/client wins (push for a real story).

PERSONALITY: If the brand walked into a room how would people describe them, 3-5 personality traits, what the brand should NEVER sound like, formality scale 1-10.

TONE & LANGUAGE: Contractions usage, slang/colloquialisms, how they address their audience, technical language level.

SCENARIOS: How they'd announce a new feature, how they'd apologize for a disruption, how they'd explain something complex to a non-technical prospect.

DIFFERENTIATION: Words/phrases they love, words/phrases they'd never say, how they want to sound different from competitors, 2-3 brands whose voice they admire, what clients say about working with them.

Start with a warm greeting using their company name, then ask about what the company does.`,

  B: `${IBASE}

YOU ARE IN SECTION B: IDEAL CUSTOMER PROFILE.

Context from Brand Voice section:
---
{SECTION_A_OUTPUT}
---

Use this context. Reference things they already told you.

Cover ALL these topics:

WHO THEY ARE: Ideal customer industry, company size (revenue/headcount), decision-maker title/role, others involved in buying, where these people hang out online (LinkedIn, forums, Slack, Reddit, events).

PROBLEM & BUYING: The problem they solve in the CUSTOMER'S words, why customers choose them over alternatives, what customers did before, what happens if they do nothing (risk of inaction), buying cycle (length, triggers, budget-driven?), what triggers them to look for a solution.

Start by acknowledging we're moving to customers and ask about their ideal customer industry.`,

  C: `${IBASE}

YOU ARE IN SECTION C: MARKETING & CHANNELS.

Context from previous sections:
---
BRAND VOICE:
{SECTION_A_OUTPUT}

ICP:
{SECTION_B_OUTPUT}
---

Cover ALL these topics:

CURRENT STATE: What marketing they do now, what's working/not (push for honesty), publishing frequency, CRM status.

GOALS & RESOURCES: 90-day success definition (push for specifics), team size for marketing, budget for tools (rough range), channels they want or want to avoid.

Start by acknowledging final stretch and ask what marketing they currently do.`
};

const GENPROMPTS = {
  A: `You are a B2B marketing expert. Create a BRAND VOICE GUIDE from this interview.

Include: 1) PERSONALITY SUMMARY — 2-3 vivid sentences, specific not generic. 2) CORE VALUES IN ACTION — how each value shows up in content. 3) CONTENT PILLARS — 3-5 themes from the transcript. 4) TONE & STYLE CHEAT SHEET — formality level, words to use (their actual language), words to avoid, contractions/slang, audience addressing. 5) SCENARIO PLAYBOOK — new feature, disruption apology, complex explanation, client win — with examples in their voice. 6) DO vs DON'T — 3+ pairs, concrete.

Be specific to THIS client. Pull their actual words.`,

  B: `You are a B2B marketing expert. Using the transcript AND Brand Voice Guide, create an IDEAL CUSTOMER PROFILE.

Include: 1) PRIMARY ICP — industry, size, decision-maker, pain points with specifics. 2) BUYING BEHAVIOR — triggers, cycle, decision-makers, objections, before state, inaction risk. 3) WHERE THEY LIVE — specific channels, communities, events. 4) MESSAGING HOOKS — 5-10 in the brand voice. 5) SECONDARY ICP if applicable.

No generic B2B filler. Ground in their actual words.`,

  C: `You are a B2B marketing expert. Using the transcript, Voice Guide, and ICP, create CHANNEL STRATEGY & CONTENT CALENDAR.

PART 1 CHANNELS: Each channel — why for this ICP, content type, cadence, effort level. Plus niche channels, channels to avoid, priority top 2-3.

PART 2 CALENDAR: 30-day calendar. Each piece: date, day, channel, type (educational/promotional/case study/engagement), headline, 2-3 sentence description, ICP segment. Mix: 60% educational, 20% case studies, 20% promotional.

Reference their marketing situation, team, and budget.`
};

const CRITPROMPT = `You are a senior B2B marketing strategist doing an internal quality review. Be direct.

Review and provide:
STRONG — What's specific and clearly from the client's words? Quote examples.
WEAK — What's generic or could apply to any company? Call out lines.
MISSING — What did they say that didn't make it in?
PUSH DEEPER — Where should the facilitator get more detail?

Short, punchy. No fluff.`;

// ============================================================
// API + STORAGE
// ============================================================
async function callAPI(system, messages, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(`API ${res.status}: ${e}`); }
  const d = await res.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

const defaultSession = () => ({
  clientName: "", currentPhase: "WELCOME", startedAt: null, contextDocs: [],
  sectionA: { messages: [], draft: null, critique: null, completedAt: null },
  sectionB: { messages: [], draft: null, critique: null, completedAt: null },
  sectionC: { messages: [], draft: null, critique: null, completedAt: null },
});

async function saveS(s) { try { await window.storage.set(SK, JSON.stringify(s)); } catch (e) {} }
async function loadS() { try { const r = await window.storage.get(SK); return r ? JSON.parse(r.value) : null; } catch (e) { return null; } }
async function clearS() { try { await window.storage.delete(SK); } catch (e) {} }

// Build transcript from session for export
function buildTranscript(session) {
  let o = `========================================\nBRAND VOICE & ICP WORKSHOP TRANSCRIPT\n========================================\nClient: ${session.clientName}\nDate: ${new Date().toLocaleDateString()}\n========================================\n`;
  if (session.contextDocs && session.contextDocs.length > 0) {
    o += `\nCONTEXT DOCUMENTS PROVIDED:\n`;
    session.contextDocs.forEach((d, i) => { o += `\n--- Document ${i + 1}: ${d.label} ---\n${d.content.slice(0, 500)}${d.content.length > 500 ? "...[truncated]" : ""}\n`; });
    o += `\n========================================\n`;
  }
  ["A", "B", "C"].forEach(s => {
    const sec = session[`section${s}`], l = SMETA[s].label;
    if (sec.messages.length === 0 && !sec.draft) return;
    o += `\nSECTION ${s}: ${l.toUpperCase()}\n${"─".repeat(40)}\n\n`;
    sec.messages.forEach(m => { o += `${m.role === "assistant" ? "Q" : "A"}: ${m.content}\n\n`; });
    if (sec.draft) o += `\n--- GENERATED: ${SMETA[s].deliv.toUpperCase()} ---\n${sec.draft}\n\n`;
    if (sec.critique) o += `--- CRITIQUE NOTES ---\n${sec.critique}\n\n`;
    o += `========================================\n`;
  });
  return o + "\nEND OF TRANSCRIPT\n";
}

function downloadText(content, filename) {
  try {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
  } catch (e) {
    // Fallback: open in new window
    const w = window.open("", "_blank");
    if (w) { w.document.write("<pre>" + content.replace(/</g, "&lt;") + "</pre>"); w.document.title = filename; }
  }
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; }
}

// ============================================================
// PROGRESS BAR + EXPORT BUTTON
// ============================================================
function ProgressBar({ phase, onExport }) {
  const pi = PHASES.indexOf(phase);
  return (
    <div style={{ display: "flex", gap: 4, padding: "12px 20px", background: CARD, borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
      {["A", "B", "C"].map((s, i) => {
        const si = 1 + i * 3, ei = si + 2, active = pi >= si && pi <= ei, done = pi > ei, m = SMETA[s];
        return (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: done ? GREEN : active ? m.color : DIM, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              <span>{m.icon}</span><span>{m.label}</span>{done && <span>✓</span>}
            </div>
            <div style={{ height: 3, borderRadius: 2, background: BORDER }}>
              <div style={{ height: "100%", borderRadius: 2, transition: "width 0.5s", background: done ? GREEN : active ? m.color : "transparent", width: done ? "100%" : active ? `${((pi - si) + 1) * 33}%` : "0%" }} />
            </div>
          </div>
        );
      })}
      <button onClick={onExport} style={{ marginLeft: 12, padding: "6px 14px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "monospace" }}>
        📋 Export
      </button>
    </div>
  );
}

// ============================================================
// WELCOME SCREEN
// ============================================================
function WelcomeScreen({ onStart, saved, onResume }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: 32 }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: TEXT, marginBottom: 8, textAlign: "center" }}>Brand Builder Workshop</h1>
      <p style={{ fontSize: 14, color: MUTED, maxWidth: 480, textAlign: "center", lineHeight: 1.6, marginBottom: 32 }}>
        AI-powered brand discovery. We'll walk through your voice, customers, and strategy — then generate your complete marketing foundation.
      </p>
      {saved && saved.currentPhase !== "WELCOME" && (
        <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginBottom: 24, maxWidth: 400, width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>Saved session found:</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 12 }}>{saved.clientName}</p>
          <button onClick={onResume} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: GREEN, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: 8 }}>Resume</button>
          <button onClick={() => { clearS(); window.location.reload(); }} style={{ padding: "8px 20px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 13, cursor: "pointer" }}>Start Fresh</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, maxWidth: 400, width: "100%" }}>
        <input type="text" placeholder="Client company name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && name.trim()) onStart(name.trim()); }}
          style={{ flex: 1, padding: "12px 16px", borderRadius: 8, border: `1px solid ${BORDER}`, background: INPUT_BG, color: TEXT, fontSize: 15, outline: "none" }} />
        <button onClick={() => name.trim() && onStart(name.trim())} disabled={!name.trim()}
          style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: name.trim() ? ACCENT : BORDER, color: name.trim() ? "#fff" : DIM, fontSize: 15, fontWeight: 600, cursor: name.trim() ? "pointer" : "default", whiteSpace: "nowrap" }}>
          Start →
        </button>
      </div>
      <div style={{ display: "flex", gap: 24, marginTop: 40, flexWrap: "wrap", justifyContent: "center" }}>
        {["A", "B", "C"].map(s => { const m = SMETA[s]; return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: DIM }}>
            <span style={{ fontSize: 16 }}>{m.icon}</span><span>{m.label} ({m.qTarget})</span>
          </div>
        ); })}
      </div>
    </div>
  );
}

// ============================================================
// CONTEXT PANEL (URLs + Doc Paste)
// ============================================================
function ContextPanel({ docs, onAdd, onRemove }) {
  const [showPanel, setShowPanel] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [pasteLabel, setPasteLabel] = useState("");

  const addUrl = () => {
    if (!urlInput.trim()) return;
    onAdd({ type: "url", label: urlInput.trim(), content: `[URL Reference: ${urlInput.trim()}] — Please reference this URL when answering questions about case studies, services, or company information.` });
    setUrlInput("");
  };

  const addPaste = () => {
    if (!pasteInput.trim()) return;
    onAdd({ type: "paste", label: pasteLabel.trim() || "Pasted Document", content: pasteInput.trim() });
    setPasteInput("");
    setPasteLabel("");
  };

  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <button onClick={() => setShowPanel(!showPanel)}
        style={{ width: "100%", padding: "8px 20px", background: CARD2, border: "none", color: MUTED, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace" }}>
        <span>📎</span>
        <span>Context Documents ({docs.length})</span>
        <span style={{ marginLeft: "auto" }}>{showPanel ? "▲" : "▼"}</span>
      </button>
      {showPanel && (
        <div style={{ padding: "12px 20px", background: CARD, display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {docs.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: CARD2, borderRadius: 4, fontSize: 12, color: MUTED }}>
                  <span>{d.type === "url" ? "🔗" : "📄"}</span>
                  <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                  <button onClick={() => onRemove(i)} style={{ background: "none", border: "none", color: DIM, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="Add a URL (homepage, case study, etc.)" value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addUrl(); }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: INPUT_BG, color: TEXT, fontSize: 13, outline: "none" }} />
            <button onClick={addUrl} disabled={!urlInput.trim()} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: urlInput.trim() ? ACCENT : BORDER, color: urlInput.trim() ? "#fff" : DIM, fontSize: 12, fontWeight: 600, cursor: urlInput.trim() ? "pointer" : "default" }}>Add URL</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input type="text" placeholder="Document label (e.g., 'Case Studies Doc')" value={pasteLabel} onChange={e => setPasteLabel(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: INPUT_BG, color: TEXT, fontSize: 13, outline: "none" }} />
            <textarea placeholder="Paste document content here..." value={pasteInput} onChange={e => setPasteInput(e.target.value)} rows={3}
              style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: INPUT_BG, color: TEXT, fontSize: 13, outline: "none", resize: "vertical", minHeight: 60, maxHeight: 200 }} />
            <button onClick={addPaste} disabled={!pasteInput.trim()} style={{ alignSelf: "flex-end", padding: "8px 14px", borderRadius: 6, border: "none", background: pasteInput.trim() ? GREEN : BORDER, color: pasteInput.trim() ? "#fff" : DIM, fontSize: 12, fontWeight: 600, cursor: pasteInput.trim() ? "pointer" : "default" }}>Add Document</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// AUTO-EXPANDING TEXTAREA
// ============================================================
function AutoTextarea({ value, onChange, onKeyDown, placeholder, disabled, inputRef, color }) {
  const adjustHeight = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  useEffect(() => {
    if (inputRef && inputRef.current) adjustHeight(inputRef.current);
  }, [value]);

  return (
    <textarea
      ref={inputRef}
      value={value}
      onChange={e => { onChange(e); adjustHeight(e.target); }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={2}
      style={{
        flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${BORDER}`,
        background: INPUT_BG, color: TEXT, fontSize: 14, outline: "none", resize: "none",
        minHeight: 56, maxHeight: 180, lineHeight: 1.5, fontFamily: "inherit",
        overflow: "auto",
      }}
    />
  );
}

// ============================================================
// INTERVIEW CHAT
// ============================================================
function InterviewChat({ section, messages, setMessages, clientName, prevOut, onComplete, contextDocs }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const initRef = useRef(false);
  const m = SMETA[section];

  const scroll = () => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; };
  useEffect(scroll, [messages]);
  useEffect(() => { if (inputRef.current && !loading) inputRef.current.focus(); }, [loading]);

  const getSys = () => {
    let p = PROMPTS[section];
    p = p.replace("{SECTION_A_OUTPUT}", prevOut.A || "Not yet available");
    p = p.replace("{SECTION_B_OUTPUT}", prevOut.B || "Not yet available");
    let contextStr = "";
    if (contextDocs && contextDocs.length > 0) {
      contextStr = "\n\nCONTEXT DOCUMENTS PROVIDED BY THE CLIENT (reference these when relevant):\n" +
        contextDocs.map((d, i) => `--- ${d.label} ---\n${d.content}`).join("\n\n");
    }
    return `${p}\n\nThe client's company name is: ${clientName}${contextStr}`;
  };

  const send = useCallback(async (userMsg = null) => {
    setError(null); setLoading(true);
    try {
      const nm = userMsg ? [...messages, { role: "user", content: userMsg }] : messages;
      if (userMsg) setMessages(nm);
      const api = nm.length === 0 ? [{ role: "user", content: `Hi, I'm from ${clientName}. Let's get started.` }] : nm;
      const resp = await callAPI(getSys(), api, 800);
      if (resp.includes("[SECTION_COMPLETE]")) {
        const clean = resp.replace("[SECTION_COMPLETE]", "").trim();
        const up = [...(userMsg ? nm : messages), { role: "assistant", content: clean }];
        setMessages(up);
        setTimeout(() => onComplete(up), 1500);
      } else {
        setMessages([...(userMsg ? nm : messages), { role: "assistant", content: resp }]);
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [messages, clientName, section, prevOut, contextDocs]);

  useEffect(() => { if (!initRef.current && messages.length === 0) { initRef.current = true; send(null); } }, []);

  const handleSend = () => { if (!input.trim() || loading) return; const msg = input.trim(); setInput(""); send(msg); };
  const uCount = messages.filter(x => x.role === "user").length;
  const minQ = section === "A" ? 10 : section === "B" ? 7 : 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 20px", background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{m.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Section {section}: {m.label}</span>
          <span style={{ fontSize: 12, color: DIM, fontFamily: "monospace" }}>— {m.qTarget} questions</span>
        </div>
        <span style={{ fontSize: 12, color: DIM, fontFamily: "monospace" }}>{uCount} answered</span>
      </div>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 14, lineHeight: 1.6,
              background: msg.role === "user" ? ACCENT : CARD2, color: msg.role === "user" ? "#fff" : TEXT,
              borderBottomRightRadius: msg.role === "user" ? 2 : 12, borderBottomLeftRadius: msg.role === "user" ? 12 : 2,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: CARD2, display: "flex", gap: 4 }}>
              {[0, 1, 2].map(d => (<div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: DIM, animation: `tp 1.2s ease-in-out ${d * 0.2}s infinite` }} />))}
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: 12, borderRadius: 8, background: `${RED}20`, border: `1px solid ${RED}40`, fontSize: 13, color: RED, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{error}</span>
            <button onClick={() => send(null)} style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid ${RED}`, background: "transparent", color: RED, fontSize: 12, cursor: "pointer" }}>Retry</button>
          </div>
        )}
      </div>
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${BORDER}`, background: CARD, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <AutoTextarea
          inputRef={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type your answer... (Shift+Enter for new line)" disabled={loading} color={m.color}
        />
        <button onClick={handleSend} disabled={!input.trim() || loading}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: input.trim() && !loading ? m.color : BORDER, color: input.trim() && !loading ? "#fff" : DIM, fontSize: 14, fontWeight: 600, cursor: input.trim() && !loading ? "pointer" : "default", whiteSpace: "nowrap", alignSelf: "flex-end", marginBottom: 1 }}>
          Send
        </button>
        {uCount >= minQ && (
          <button onClick={() => onComplete(messages)} disabled={loading}
            style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-end", marginBottom: 1 }}>
            Wrap up →
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// GENERATING SCREEN
// ============================================================
function GeneratingScreen({ section, messages, prevOut, onComplete, contextDocs }) {
  const [stage, setStage] = useState("summarizing");
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState(null);
  const m = SMETA[section];
  const started = useRef(false);

  useEffect(() => { if (!started.current) { started.current = true; run(); } }, []);

  const fmtTranscript = () => messages.map(x => `${x.role === "assistant" ? "Q" : "A"}: ${x.content}`).join("\n\n");

  async function run() {
    try {
      setSummary(messages.filter(x => x.role === "user").map(x => x.content).filter(c => c.length > 10).slice(0, 8).map(a => a.slice(0, 120) + (a.length > 120 ? "..." : "")));
      setStage("drafting");
      let ctx = "";
      if (prevOut.A) ctx += `\n\nBRAND VOICE GUIDE:\n${prevOut.A}`;
      if (prevOut.B) ctx += `\n\nICP PROFILE:\n${prevOut.B}`;
      let docCtx = "";
      if (contextDocs && contextDocs.length > 0) {
        docCtx = "\n\nCONTEXT DOCUMENTS:\n" + contextDocs.map(d => `--- ${d.label} ---\n${d.content}`).join("\n\n");
      }
      const t = fmtTranscript();
      const draft = await callAPI(GENPROMPTS[section], [{ role: "user", content: `INTERVIEW TRANSCRIPT:\n\n${t}${ctx}${docCtx}` }], 4000);
      setStage("critiquing");
      const critique = await callAPI(CRITPROMPT, [{ role: "user", content: `DELIVERABLE:\n\n${draft}\n\nTRANSCRIPT:\n\n${t}` }], 2000);
      setStage("complete");
      onComplete(draft, critique);
    } catch (e) { setError(e.message); }
  }

  const stages = [
    { key: "summarizing", label: "Compiling answers", icon: "📋" },
    { key: "drafting", label: `Generating ${m.deliv}`, icon: "✍️" },
    { key: "critiquing", label: "Quality review", icon: "🔍" },
    { key: "complete", label: "Done", icon: "✅" },
  ];
  const si = stages.findIndex(s => s.key === stage);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 32 }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{m.icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Building your {m.deliv}</h2>
      <p style={{ fontSize: 13, color: MUTED, marginBottom: 32 }}>This takes about 30-60 seconds</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 400, marginBottom: 32 }}>
        {stages.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: i === si ? `${m.color}15` : "transparent", border: i === si ? `1px solid ${m.color}30` : "1px solid transparent" }}>
            <span style={{ fontSize: 16, filter: i > si ? "grayscale(1) opacity(0.3)" : "none" }}>{i < si ? "✅" : s.icon}</span>
            <span style={{ fontSize: 13, fontFamily: "monospace", color: i <= si ? TEXT : DIM, fontWeight: i === si ? 600 : 400 }}>{s.label}</span>
            {i === si && stage !== "complete" && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                {[0, 1, 2].map(d => (<div key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: m.color, animation: `tp 1.2s ease-in-out ${d * 0.2}s infinite` }} />))}
              </div>
            )}
          </div>
        ))}
      </div>
      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: `${RED}20`, border: `1px solid ${RED}40`, fontSize: 13, color: RED, maxWidth: 400, width: "100%", textAlign: "center" }}>
          <p style={{ marginBottom: 8 }}>{error}</p>
          <button onClick={() => { setError(null); started.current = false; run(); }} style={{ padding: "6px 16px", borderRadius: 4, border: `1px solid ${RED}`, background: "transparent", color: RED, fontSize: 12, cursor: "pointer" }}>Retry</button>
        </div>
      )}
      {summary.length > 0 && (
        <div style={{ maxWidth: 500, width: "100%" }}>
          <p style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "monospace" }}>Key answers captured</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
            {summary.map((s, i) => (<div key={i} style={{ fontSize: 12, color: MUTED, padding: "6px 10px", background: CARD2, borderRadius: 4, lineHeight: 1.4 }}>{s}</div>))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// REVIEW SCREEN
// ============================================================
function ReviewScreen({ section, draft, critique, onApprove }) {
  const m = SMETA[section];
  const next = section === "C" ? "Finish" : `Continue to ${SMETA[section === "A" ? "B" : "C"].label}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 20px", background: CARD, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{m.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Review: {m.deliv}</span>
        </div>
        <button onClick={onApprove} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: GREEN, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{next} →</button>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 3, overflowY: "auto", padding: 20, borderRight: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontFamily: "monospace" }}>Draft</div>
          <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{draft}</div>
        </div>
        <div style={{ flex: 2, overflowY: "auto", padding: 20, background: `${CARD}80` }}>
          <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontFamily: "monospace" }}>Critique & Notes</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{critique}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPLETION SCREEN
// ============================================================
function CompletionScreen({ session }) {
  const [tab, setTab] = useState("A");
  const [copied, setCopied] = useState(false);

  const tx = buildTranscript(session);
  const delivs = ["A", "B", "C"].map(s => session[`section${s}`].draft).filter(Boolean).join("\n\n" + "=".repeat(50) + "\n\n");
  const fn = session.clientName.replace(/\s+/g, "_");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 20px", background: `${GREEN}10`, borderBottom: `1px solid ${GREEN}30`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>🎉 {session.clientName}'s workshop is complete</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Export everything and take it into Claude Projects for final polish.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={async () => { await copyText(tx); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: TEXT, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {copied ? "✓ Copied!" : "📋 Copy All"}
          </button>
          <button onClick={() => downloadText(tx, `${fn}_Full_Transcript.txt`)}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⬇ Transcript
          </button>
          <button onClick={() => downloadText(delivs, `${fn}_Deliverables.txt`)}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: GREEN, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⬇ Deliverables
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${BORDER}` }}>
        {["A", "B", "C"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 20px", border: "none", borderBottom: tab === t ? `2px solid ${SMETA[t].color}` : "2px solid transparent", background: "transparent", color: tab === t ? TEXT : DIM, fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: "pointer" }}>
            {SMETA[t].icon} {SMETA[t].deliv}
          </button>
        ))}
        <button onClick={() => setTab("next")} style={{ padding: "10px 20px", border: "none", borderBottom: tab === "next" ? `2px solid ${TEXT}` : "2px solid transparent", background: "transparent", color: tab === "next" ? TEXT : DIM, fontSize: 13, fontWeight: tab === "next" ? 600 : 400, cursor: "pointer" }}>
          🚀 What's Next
        </button>
      </div>

      {tab !== "next" ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 3, overflowY: "auto", padding: 20, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontFamily: "monospace" }}>Deliverable Draft</div>
            <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{session[`section${tab}`].draft || "Not yet generated."}</div>
          </div>
          <div style={{ flex: 2, overflowY: "auto", padding: 20, background: `${CARD}80` }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontFamily: "monospace" }}>Critique & Notes</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{session[`section${tab}`].critique || "Not yet generated."}</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 32, maxWidth: 640 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 16 }}>What to Do Next</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { num: "1", title: "Download the transcript", desc: "Hit the 'Transcript' button above. This includes the full interview Q&A, all generated drafts, and critique notes." },
              { num: "2", title: "Open Claude Projects", desc: "Go to claude.ai → Projects → Create New Project. Name it after the client." },
              { num: "3", title: "Set up the project", desc: "Paste the System Prompt (from your toolkit) into the Project Instructions. Upload the transcript file. Upload any client assets (homepage copy, emails, case studies)." },
              { num: "4", title: "Refine the deliverables", desc: "Paste each draft into Claude and ask it to refine based on the critique notes. This is where the quality jumps — Claude in the project has better context and you can iterate." },
              { num: "5", title: "Send to client for approval", desc: "Share the Brand Voice Guide and ICP first. Get sign-off before generating the content calendar and Week 1 content." },
              { num: "6", title: "Generate content", desc: "Once approved, run the Phase 2 prompt in the same project. Claude will produce channel strategy, 30-day calendar, and a full week of ready-to-publish content." },
              { num: "7", title: "Keep going", desc: "Use the monthly review and scale-up prompts from your runbook for ongoing engagement." },
            ].map(step => (
              <div key={step.num} style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{step.num}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 16, background: `${ACCENT}10`, border: `1px solid ${ACCENT}30`, borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>
              <strong>Why not just use these drafts?</strong> You can — they're a solid starting point. But the drafts were generated by Sonnet via API, and working directly in Claude Projects with the full transcript gives you better output quality, plus the ability to iterate and push for depth on specific sections.
            </p>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 20px", borderTop: `1px solid ${BORDER}`, background: CARD, textAlign: "center" }}>
        <button onClick={async () => { await clearS(); window.location.reload(); }} style={{ padding: "8px 20px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, cursor: "pointer" }}>Start New Session</button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [session, setSession] = useState(defaultSession());
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(null);
  const [exportMsg, setExportMsg] = useState(null);

  useEffect(() => { loadS().then(s => { if (s) setSaved(s); setLoaded(true); }); }, []);

  const upd = useCallback((u) => { setSession(p => { const n = { ...p, ...u }; saveS(n); return n; }); }, []);
  const updSec = useCallback((s, u) => { setSession(p => { const k = `section${s}`, n = { ...p, [k]: { ...p[k], ...u } }; saveS(n); return n; }); }, []);
  const setPh = useCallback((ph) => upd({ currentPhase: ph }), [upd]);

  const addDoc = (doc) => { setSession(p => { const n = { ...p, contextDocs: [...(p.contextDocs || []), doc] }; saveS(n); return n; }); };
  const removeDoc = (idx) => { setSession(p => { const docs = [...(p.contextDocs || [])]; docs.splice(idx, 1); const n = { ...p, contextDocs: docs }; saveS(n); return n; }); };

  const start = (name) => { const s = { ...defaultSession(), clientName: name, currentPhase: "SA_INT", startedAt: new Date().toISOString() }; setSession(s); saveS(s); };
  const resume = () => { if (saved) setSession(saved); };
  const po = { A: session.sectionA.draft, B: session.sectionB.draft };

  const handleExport = async () => {
    const tx = buildTranscript(session);
    await copyText(tx);
    setExportMsg("Transcript copied to clipboard!");
    setTimeout(() => setExportMsg(null), 2500);
  };

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: DIM, fontSize: 14, fontFamily: "monospace" }}>Loading...</div>
    </div>
  );

  const ph = session.currentPhase;
  const showContext = ph.endsWith("_INT");
  const contextDocs = session.contextDocs || [];

  const render = () => {
    switch (ph) {
      case "WELCOME": return <WelcomeScreen onStart={start} saved={saved} onResume={resume} />;
      case "SA_INT": return <InterviewChat section="A" messages={session.sectionA.messages} setMessages={m => updSec("A", { messages: m })} clientName={session.clientName} prevOut={po} onComplete={msgs => { updSec("A", { messages: msgs }); setPh("SA_GEN"); }} contextDocs={contextDocs} />;
      case "SA_GEN": return <GeneratingScreen section="A" messages={session.sectionA.messages} prevOut={po} onComplete={(d, c) => { updSec("A", { draft: d, critique: c, completedAt: new Date().toISOString() }); setPh("SA_REV"); }} contextDocs={contextDocs} />;
      case "SA_REV": return <ReviewScreen section="A" draft={session.sectionA.draft} critique={session.sectionA.critique} onApprove={() => setPh("SB_INT")} />;
      case "SB_INT": return <InterviewChat section="B" messages={session.sectionB.messages} setMessages={m => updSec("B", { messages: m })} clientName={session.clientName} prevOut={po} onComplete={msgs => { updSec("B", { messages: msgs }); setPh("SB_GEN"); }} contextDocs={contextDocs} />;
      case "SB_GEN": return <GeneratingScreen section="B" messages={session.sectionB.messages} prevOut={po} onComplete={(d, c) => { updSec("B", { draft: d, critique: c, completedAt: new Date().toISOString() }); setPh("SB_REV"); }} contextDocs={contextDocs} />;
      case "SB_REV": return <ReviewScreen section="B" draft={session.sectionB.draft} critique={session.sectionB.critique} onApprove={() => setPh("SC_INT")} />;
      case "SC_INT": return <InterviewChat section="C" messages={session.sectionC.messages} setMessages={m => updSec("C", { messages: m })} clientName={session.clientName} prevOut={po} onComplete={msgs => { updSec("C", { messages: msgs }); setPh("SC_GEN"); }} contextDocs={contextDocs} />;
      case "SC_GEN": return <GeneratingScreen section="C" messages={session.sectionC.messages} prevOut={po} onComplete={(d, c) => { updSec("C", { draft: d, critique: c, completedAt: new Date().toISOString() }); setPh("SC_REV"); }} contextDocs={contextDocs} />;
      case "SC_REV": return <ReviewScreen section="C" draft={session.sectionC.draft} critique={session.sectionC.critique} onApprove={() => setPh("COMPLETE")} />;
      case "COMPLETE": return <CompletionScreen session={session} />;
      default: return <WelcomeScreen onStart={start} saved={saved} onResume={resume} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes tp{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${BORDER};border-radius:3px}
        textarea::placeholder,input::placeholder{color:${DIM}}
      `}</style>
      {ph !== "WELCOME" && <ProgressBar phase={ph} onExport={handleExport} />}
      {exportMsg && (
        <div style={{ padding: "8px 20px", background: `${GREEN}20`, borderBottom: `1px solid ${GREEN}30`, fontSize: 13, color: GREEN, textAlign: "center", fontWeight: 600 }}>
          ✓ {exportMsg}
        </div>
      )}
      {showContext && <ContextPanel docs={contextDocs} onAdd={addDoc} onRemove={removeDoc} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>{render()}</div>
    </div>
  );
}
