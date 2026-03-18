import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const parseUTC = (d) => {
  if (!d) return null;
  const s = String(d);
  return new Date(s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z");
};
const fmt = (d) => { const p = parseUTC(d); return p ? p.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; };
const fmtDate = (d) => { const p = parseUTC(d); return p ? p.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; };
const timeAgo = (d) => {
  const date = parseUTC(d);
  if (!date) return "never";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

const AGENT_STEPS = ["Research", "Medication", "Environment", "Monitor", "Coordinator"];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0f1117; --paper: #f5f2eb; --cream: #ede9df; --rule: #d6d0c4;
    --accent: #c94f2e; --accent-pale: #f5e8e4;
    --green: #2a6b4a; --green-pale: #e4f0ea;
    --amber: #b87a1a; --amber-pale: #fdf3df;
    --blue: #1a5fa8; --blue-pale: #e6f0fb;
    --mono: 'DM Mono', monospace; --serif: 'DM Serif Display', serif; --sans: 'Instrument Sans', sans-serif;
  }
  body { background: var(--paper); color: var(--ink); font-family: var(--sans); min-height: 100vh; }

  .masthead { border-bottom: 2px solid var(--ink); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; background: var(--paper); }
  .masthead-title { font-family: var(--serif); font-size: 1.7rem; letter-spacing: -0.02em; }

  .layout { display: grid; grid-template-columns: 270px 1fr; min-height: calc(100vh - 60px); }
  .sidebar { border-right: 1px solid var(--rule); padding: 1.25rem; background: var(--cream); overflow-y: auto; }
  .sidebar-label { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: #999; margin-bottom: 0.6rem; }

  .patient-card { border: 1px solid var(--rule); border-radius: 4px; padding: 0.8rem 0.9rem; margin-bottom: 0.4rem; cursor: pointer; background: var(--paper); transition: all 0.15s ease; }
  .patient-card:hover { border-color: var(--ink); }
  .patient-card.active { border-color: var(--accent); background: var(--accent-pale); }
  .patient-card-name { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.15rem; }
  .patient-card-meta { font-family: var(--mono); font-size: 0.65rem; color: #888; }
  .patient-card-analyzed { font-family: var(--mono); font-size: 0.6rem; color: var(--green); margin-top: 0.25rem; }
  .tag { display: inline-block; font-family: var(--mono); font-size: 0.6rem; padding: 0.12rem 0.35rem; border-radius: 2px; margin: 0.12rem 0.12rem 0 0; background: var(--cream); border: 1px solid var(--rule); color: #666; }
  .tag.med { background: var(--amber-pale); border-color: var(--amber); color: var(--amber); }
  .tag.cond { background: var(--blue-pale); border-color: var(--blue); color: var(--blue); }

  .main { padding: 1.75rem 2rem; overflow-y: auto; max-height: calc(100vh - 60px); }

  /* ── PATIENT HEADER ── */
  .patient-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); }
  .patient-name { font-family: var(--serif); font-size: 1.6rem; letter-spacing: -0.01em; margin-bottom: 0.2rem; }
  .patient-subtitle { font-family: var(--mono); font-size: 0.65rem; color: #999; }
  .btn-row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  .btn { font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.5rem 1rem; border: 1.5px solid var(--ink); border-radius: 3px; background: var(--ink); color: var(--paper); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn:hover { background: #2a2a2a; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.outline { background: transparent; color: var(--ink); }
  .btn.outline:hover { background: var(--ink); color: var(--paper); }

  /* ── ZONE LABELS ── */
  .zone-label { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; color: #bbb; padding: 0.3rem 0; margin: 1.25rem 0 0.75rem; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; }
  .zone-label span.live { color: var(--accent); font-weight: 600; }

  /* ── PERMANENT SNAPSHOT (Zone A) ── */
  .snapshot { border: 1.5px solid var(--ink); border-radius: 6px; overflow: hidden; margin-bottom: 0; }
  .snapshot-header { background: #e8edf2; color: #1a2332; padding: 0.65rem 1.1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccd4de; }
  .snapshot-title { font-family: var(--serif); font-size: 0.95rem; }
  .snapshot-meta { font-family: var(--mono); font-size: 0.6rem; color: #6b7a8d; }

  /* Status bar inside snapshot */
  .snap-status { display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 1.1rem; border-bottom: 1px solid var(--rule); }
  .snap-status.stable    { background: var(--green-pale); }
  .snap-status.attention { background: var(--amber-pale); }
  .snap-status.critical  { background: var(--accent-pale); }
  .snap-pill { font-family: var(--mono); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.18rem 0.55rem; border-radius: 20px; color: #fff; flex-shrink: 0; }
  .snap-status.stable    .snap-pill { background: var(--green); }
  .snap-status.attention .snap-pill { background: var(--amber); }
  .snap-status.critical  .snap-pill { background: var(--accent); }
  .snap-reason { font-size: 0.82rem; color: #333; line-height: 1.4; }
  .snap-no-analysis { padding: 0.6rem 1.1rem; font-family: var(--mono); font-size: 0.7rem; color: #bbb; background: var(--cream); border-bottom: 1px solid var(--rule); }

  /* Snapshot info rows */
  .snap-row { display: flex; align-items: baseline; gap: 0.75rem; padding: 0.5rem 1.1rem; border-bottom: 1px solid var(--rule); }
  .snap-row:last-child { border-bottom: none; }
  .snap-row-label { font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: #aaa; width: 6rem; flex-shrink: 0; }
  .snap-row-val { font-size: 0.82rem; color: #333; }

  /* Vitals clinical table */
  .vitals-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .vitals-table thead tr { background: #e8edf2; color: #1a2332; }
  .vitals-table thead th { font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.55rem 0.9rem; text-align: left; font-weight: 600; border-bottom: 1px solid #ccd4de; }
  .vitals-table tbody tr:nth-child(odd)  { background: var(--cream); }
  .vitals-table tbody tr:nth-child(even) { background: var(--paper); }
  .vitals-table td { padding: 0.55rem 0.9rem; border-bottom: 1px solid var(--rule); color: #333; vertical-align: middle; }
  .vitals-table td:first-child { font-family: var(--mono); font-size: 0.72rem; color: #666; }
  .vitals-table td:nth-child(2) { font-weight: 600; }
  .vitals-table td:nth-child(3) { font-family: var(--mono); font-size: 0.7rem; color: #999; }
  .vitals-badge { font-family: var(--mono); font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.18rem 0.55rem; border-radius: 20px; display: inline-block; }
  .vitals-badge.normal     { background: var(--green-pale);  color: var(--green); border: 1px solid var(--green); }
  .vitals-badge.borderline { background: var(--amber-pale);  color: var(--amber); border: 1px solid var(--amber); }
  .vitals-badge.abnormal   { background: var(--accent-pale); color: var(--accent); border: 1px solid var(--accent); }
  .vitals-badge.na         { background: var(--cream); color: #bbb; border: 1px solid var(--rule); }
  .vitals-table-footer { font-family: var(--mono); font-size: 0.6rem; color: #aaa; padding: 0.45rem 0.9rem; border-top: 1px solid var(--rule); background: var(--cream); }

  /* Agent progress */
  .pulse-bar { height: 3px; background: linear-gradient(90deg, var(--accent), var(--amber), var(--green), var(--accent)); background-size: 200% 100%; animation: pulse 1.5s linear infinite; border-radius: 2px; margin-bottom: 1rem; }
  @keyframes pulse { to { background-position: -200% 0; } }
  .agent-steps { display: flex; gap: 0.4rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .agent-step { font-family: var(--mono); font-size: 0.62rem; padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid var(--rule); color: #999; background: var(--cream); transition: all 0.3s; }
  .agent-step.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .agent-step.done { background: var(--green-pale); color: var(--green); border-color: var(--green); }

  /* ── LIVE INTELLIGENCE SUMMARY (Zone B) ── */
  .live-summary { border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; margin-bottom: 1rem; }
  .live-summary-header { background: var(--cream); padding: 0.6rem 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--rule); }
  .live-summary-title { font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: #555; font-weight: 600; }
  .live-summary-date { font-family: var(--mono); font-size: 0.6rem; color: #aaa; }

  /* Key findings */
  .findings-list { list-style: none; }
  .findings-list li { display: flex; gap: 0.6rem; align-items: baseline; padding: 0.55rem 1rem; border-bottom: 1px solid var(--rule); font-size: 0.82rem; line-height: 1.55; }
  .findings-list li:last-child { border-bottom: none; }
  .finding-num { font-family: var(--mono); font-size: 0.6rem; color: #bbb; flex-shrink: 0; }

  /* Next steps */
  .steps-list { list-style: none; }
  .steps-list li { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.6rem 1rem; border-bottom: 1px solid var(--rule); }
  .steps-list li:last-child { border-bottom: none; }
  .step-num { font-family: var(--mono); font-size: 0.62rem; font-weight: 700; background: var(--ink); color: var(--paper); width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 0.15rem; }
  .step-cond { color: var(--blue); font-weight: 600; }
  .step-body { font-size: 0.82rem; line-height: 1.55; }
  .followup-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 1rem; background: var(--cream); border-top: 1px solid var(--rule); font-size: 0.8rem; }
  .followup-label { font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: #aaa; flex-shrink: 0; }

  /* ── AGENT CARDS ── */
  .agent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
  .agent-card { border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; }
  .agent-card-hdr { padding: 0.5rem 0.85rem; font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
  .agent-card-hdr.green { background: var(--green); color: #fff; }
  .agent-card-hdr.amber { background: var(--amber); color: #fff; }
  .agent-card-hdr.blue  { background: var(--blue);  color: #fff; }
  .agent-card-body { padding: 0.8rem; font-size: 0.78rem; line-height: 1.65; white-space: pre-wrap; background: var(--paper); max-height: 130px; overflow-y: auto; color: #444; }

  /* ── NOTES ── */
  .section-hdr { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 0.6rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--rule); display: flex; justify-content: space-between; }
  .notes-input-row { display: flex; gap: 0.5rem; margin-bottom: 0.6rem; }
  .notes-textarea { flex: 1; padding: 0.55rem 0.75rem; border: 1px solid var(--rule); border-radius: 3px; font-family: var(--sans); font-size: 0.82rem; background: var(--paper); color: var(--ink); resize: none; height: 56px; }
  .notes-textarea:focus { outline: none; border-color: var(--ink); }
  .note-item { border: 1px solid var(--rule); border-radius: 4px; padding: 0.6rem 0.85rem; margin-bottom: 0.35rem; background: var(--paper); display: flex; gap: 0.6rem; }
  .note-body { flex: 1; font-size: 0.82rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .note-meta { font-family: var(--mono); font-size: 0.58rem; color: #aaa; margin-top: 0.2rem; }
  .note-del { font-family: var(--mono); font-size: 0.62rem; color: #ccc; background: none; border: none; cursor: pointer; padding: 0.1rem 0.3rem; border-radius: 2px; flex-shrink: 0; }
  .note-del:hover { color: var(--accent); background: var(--accent-pale); }

  /* ── HISTORY ── */
  .history-item { border: 1px solid var(--rule); border-radius: 4px; margin-bottom: 0.4rem; overflow: hidden; cursor: pointer; background: var(--paper); transition: border-color 0.15s; }
  .history-item:hover { border-color: var(--ink); }
  .history-item-hdr { padding: 0.6rem 1rem; display: flex; justify-content: space-between; align-items: center; background: var(--cream); }
  .history-item-date { font-family: var(--mono); font-size: 0.66rem; font-weight: 500; }
  .history-item-ago { font-family: var(--mono); font-size: 0.6rem; color: #999; }
  .history-item-body { padding: 0.85rem 1rem; font-size: 0.78rem; line-height: 1.65; white-space: pre-wrap; border-top: 1px solid var(--rule); max-height: 180px; overflow-y: auto; }
  .empty-sub { font-family: var(--mono); font-size: 0.7rem; color: #ccc; padding: 0.75rem 0; }

  .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { text-align: center; padding: 4rem 2rem; color: #aaa; }
  .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.4; }
  .empty-text { font-family: var(--serif); font-size: 1.1rem; font-style: italic; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(15,17,23,0.55); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
  .modal { background: var(--paper); border: 1.5px solid var(--ink); border-radius: 6px; width: 580px; max-height: 85vh; overflow-y: auto; padding: 1.75rem; }
  .modal-title { font-family: var(--serif); font-size: 1.3rem; margin-bottom: 1.25rem; padding-bottom: 0.65rem; border-bottom: 1px solid var(--rule); }
  .form-group { margin-bottom: 0.85rem; }
  .form-label { display: block; font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: #777; margin-bottom: 0.35rem; }
  .form-input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid var(--rule); border-radius: 3px; font-family: var(--sans); font-size: 0.85rem; background: var(--paper); color: var(--ink); }
  .form-input:focus { outline: none; border-color: var(--ink); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .modal-divider { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: #bbb; margin: 1rem 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--rule); }
`;

const cleanText = (t) => {
  if (!t) return "";
  return t.replace(/^#{1,4}\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[•*\-]\s+/gm, "").replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n").trim();
};

const parseSection = (text, header) => {
  if (!text) return "";
  const regex = new RegExp(`###[^#\n]*${header}[^\n]*\n([\\s\\S]*?)(?=\n###|$)`, "i");
  const m = text.match(regex);
  return m ? m[1].trim() : "";
};

const parseSummary = (text) => {
  if (!text) return null;
  const statusRaw = parseSection(text, "STATUS");
  if (!statusRaw) return null;
  const statusLine = statusRaw.split("\n")[0].trim();
  const level = /critical/i.test(statusLine) ? "critical"
    : /attention|concern|uncontrolled|borderline/i.test(statusLine) ? "attention" : "stable";
  const label = level === "critical" ? "Critical" : level === "attention" ? "Needs Attention" : "Stable";
  const reason = statusLine.replace(/^(stable|needs attention|critical)\s*[—–\-]\s*/i, "").trim();

  const findingsRaw = parseSection(text, "KEY FINDINGS") || parseSection(text, "FINDINGS");
  const findings = findingsRaw
    ? [...findingsRaw.matchAll(/^[•\-*]\s*(.+)/gm)].map(m => m[1].trim()).slice(0, 3) : [];

  const stepsRaw = parseSection(text, "NEXT STEPS") || parseSection(text, "NEXT STEP");
  const nextSteps = stepsRaw
    ? [...stepsRaw.matchAll(/^\d+\.\s*(.+)/gm)].map(m => m[1].trim()).slice(0, 4) : [];

  const followUp = parseSection(text, "FOLLOW-UP")?.split("\n")[0]?.trim() || null;
  return { level, label, reason, findings, nextSteps, followUp };
};

const EMPTY_P = { name: "", age: "", gender: "Female", location: "", conditions: "", medications: "" };
const EMPTY_V = { heart_rate: "", blood_pressure_systolic: "", blood_pressure_diastolic: "", temperature: "", oxygen_saturation: "", blood_glucose: "", weight_kg: "" };

export default function App() {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [showModal, setShowModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [newPatient, setNewPatient] = useState(EMPTY_P);
  const [newVitals, setNewVitals] = useState(EMPTY_V);
  const [noteText, setNoteText] = useState("");


  useEffect(() => {
    fetch(`${API_BASE}/patients`).then(r => r.json()).then(d => setPatients(d.patients || [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (!selected?._id) return;
    setHistory([]); setReport(null);
    fetch(`${API_BASE}/patients/${selected._id}`).then(r => r.json()).then(p => {
      setSelected(p);
      if (p.last_report?.final_report) setReport(p.last_report);
    }).catch(() => { });
    fetch(`${API_BASE}/patients/${selected._id}/reports?limit=10`).then(r => r.json()).then(d => setHistory(d.reports || [])).catch(() => { });
  }, [selected?._id]);

  const runAnalysis = async () => {
    if (!selected) return;
    setLoading(true); setReport(null); setActiveStep(0);
    for (let i = 0; i < AGENT_STEPS.length; i++) { setActiveStep(i); await new Promise(r => setTimeout(r, 900)); }
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: selected._id }),
      });
      const data = await res.json();
      const r = { ...data, generated_at: new Date().toISOString() };
      setReport(r);
      setHistory(prev => [{ _id: data.report_id, final_report: data.final_report, generated_at: r.generated_at }, ...prev]);
      fetch(`${API_BASE}/patients/${selected._id}`).then(x => x.json()).then(p => {
        setSelected(p); setPatients(prev => prev.map(x => x._id === p._id ? p : x));
      }).catch(() => { });
    } catch (err) { console.error("Analysis failed", err); alert("Analysis failed — check that the backend is running and API keys are set."); }
    setLoading(false); setActiveStep(-1);
  };

  const savePatient = async () => {
    const body = {
      name: newPatient.name, age: parseInt(newPatient.age), gender: newPatient.gender, location: newPatient.location,
      conditions: newPatient.conditions.split(",").map(s => s.trim()).filter(Boolean),
      medications: newPatient.medications.split(",").map(s => s.trim()).filter(Boolean)
    };
    const vitalsBody = Object.fromEntries(Object.entries(newVitals).filter(([, v]) => v !== "").map(([k, v]) => [k, parseFloat(v)]));
    if (editingPatient) {
      await fetch(`${API_BASE}/patients/${editingPatient._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => { });
      if (Object.keys(vitalsBody).length > 0) await fetch(`${API_BASE}/patients/${editingPatient._id}/vitals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vitalsBody) }).catch(() => { });
      const updated = await fetch(`${API_BASE}/patients/${editingPatient._id}`).then(r => r.json()).catch(() => null);
      if (updated) { setSelected(updated); setPatients(prev => prev.map(p => p._id === updated._id ? updated : p)); }
    } else {
      try {
        const res = await fetch(`${API_BASE}/patients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (Object.keys(vitalsBody).length > 0) await fetch(`${API_BASE}/patients/${data.patient_id}/vitals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vitalsBody) }).catch(() => { });
        const newP = { _id: data.patient_id, ...body };
        setPatients(prev => [newP, ...prev]); setSelected(newP);
      } catch { const newP = { _id: `local_${Date.now()}`, ...body }; setPatients(prev => [newP, ...prev]); setSelected(newP); }
    }
    setShowModal(false); setEditingPatient(null); setNewPatient(EMPTY_P); setNewVitals(EMPTY_V);
  };

  const submitVitals = async () => {
    const body = Object.fromEntries(Object.entries(newVitals).filter(([, v]) => v !== "").map(([k, v]) => [k, parseFloat(v)]));
    await fetch(`${API_BASE}/patients/${selected._id}/vitals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => { });
    fetch(`${API_BASE}/patients/${selected._id}`).then(r => r.json()).then(p => setSelected(p)).catch(() => { });
    setShowVitalsModal(false); setNewVitals(EMPTY_V);
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    await fetch(`${API_BASE}/patients/${selected._id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: noteText.trim() }) }).catch(() => { });
    setNoteText("");
    fetch(`${API_BASE}/patients/${selected._id}`).then(r => r.json()).then(p => { setSelected(p); setPatients(prev => prev.map(x => x._id === p._id ? p : x)); }).catch(() => { });
  };

  const deleteNote = async (noteId) => {
    await fetch(`${API_BASE}/patients/${selected._id}/notes/${noteId}`, { method: "DELETE" }).catch(() => { });
    fetch(`${API_BASE}/patients/${selected._id}`).then(r => r.json()).then(p => { setSelected(p); setPatients(prev => prev.map(x => x._id === p._id ? p : x)); }).catch(() => { });
  };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([report.final_report], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${selected?.name?.replace(" ", "_")}_${new Date().toISOString().slice(0, 10)}.txt`; a.click();
  };

  const latestVitals = selected?.vitals_history?.[selected.vitals_history.length - 1];
  const summary = report ? parseSummary(report.final_report) : null;

  return (
    <>
      <style>{css}</style>
      <header className="masthead">
        <div className="masthead-title">HealthIntel</div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">Patients ({patients.length})</div>
          {patients.map(p => (
            <div key={p._id} className={`patient-card ${selected?._id === p._id ? "active" : ""}`}
              onClick={() => { setSelected(p); setReport(null); }}>
              <div className="patient-card-name">{p.name}</div>
              <div className="patient-card-meta">{p.age}y · {p.gender || "—"} · {p.location || "—"}</div>
              <div style={{ marginTop: "0.3rem" }}>{p.conditions?.slice(0, 2).map(c => <span key={c} className="tag cond">{c}</span>)}</div>
              {p.last_analyzed && <div className="patient-card-analyzed">● Analyzed {timeAgo(p.last_analyzed)}</div>}
            </div>
          ))}
          <button className="btn outline" style={{ width: "100%", marginTop: "0.6rem" }} onClick={() => setShowModal(true)}>+ Add Patient</button>
        </aside>

        <main className="main">
          {!selected ? (
            <div className="empty-state"><div className="empty-icon">🏥</div><div className="empty-text">Select a patient to begin</div></div>
          ) : (
            <>
              {/* Header */}
              <div className="patient-header">
                <div>
                  <div className="patient-name">{selected.name}</div>
                  <div className="patient-subtitle">
                    ID: {selected._id?.slice(-8)} · Added {fmtDate(selected.created_at)}
                    {selected.last_analyzed && ` · Last analyzed ${fmt(selected.last_analyzed)}`}
                  </div>
                </div>
                <div className="btn-row">
                  {report && <button className="btn outline" onClick={exportReport}>↓ Export</button>}
                  <button className="btn outline" onClick={() => {
                    setEditingPatient(selected);
                    setNewPatient({ name: selected.name || "", age: selected.age?.toString() || "", gender: selected.gender || "Female", location: selected.location || "", conditions: selected.conditions?.join(", ") || "", medications: selected.medications?.join(", ") || "" });
                    setNewVitals(EMPTY_V); setShowModal(true);
                  }}>✎ Edit</button>
                  <button className="btn outline" onClick={() => setShowVitalsModal(true)}>+ Vitals</button>
                  <button className="btn" onClick={runAnalysis} disabled={loading}>
                    {loading ? <><span className="spinner" />&nbsp;Analyzing…</> : "▶ Run Analysis"}
                  </button>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════
                  ZONE A — PERMANENT PATIENT SNAPSHOT
                  Always visible. Updated after each analysis.
              ═══════════════════════════════════════════════════ */}
              <div className="zone-label">
                <span>Patient Snapshot</span>
                {selected.last_analyzed && <span style={{ color: "#bbb" }}>Updated {timeAgo(selected.last_analyzed)}</span>}
              </div>

              <div className="snapshot">

                {/* Status line — from last analysis */}
                {summary ? (
                  <div className={`snap-status ${summary.level}`}>
                    <span className="snap-pill">{summary.label}</span>
                    <span className="snap-reason">{summary.reason}</span>
                  </div>
                ) : (
                  <div className="snap-no-analysis">No analysis run yet — click Run Analysis to generate clinical brief</div>
                )}

                {/* Conditions + Medications */}
                <div className="snap-row">
                  <span className="snap-row-label">Conditions</span>
                  <span>{selected.conditions?.length ? selected.conditions.map(c => <span key={c} className="tag cond">{c}</span>) : <span className="snap-row-val" style={{ color: "#ccc" }}>None</span>}</span>
                </div>
                <div className="snap-row">
                  <span className="snap-row-label">Medications</span>
                  <span>{selected.medications?.length ? selected.medications.map(m => <span key={m} className="tag med">{m}</span>) : <span className="snap-row-val" style={{ color: "#ccc" }}>None</span>}</span>
                </div>

                {/* Latest vitals clinical table */}
                {latestVitals && (() => {
                  const vitalDef = (key, label, unit, reading, rangeLabel, badge) => {
                    if (reading == null) return null;
                    return { key, label, unit, reading, rangeLabel, badge };
                  };
                  const hr  = latestVitals.heart_rate;
                  const sys = latestVitals.blood_pressure_systolic;
                  const dia = latestVitals.blood_pressure_diastolic;
                  const o2  = latestVitals.oxygen_saturation;
                  const glu = latestVitals.blood_glucose;
                  const tmp = latestVitals.temperature;
                  const wt  = latestVitals.weight_kg;

                  const badge = (val, lo, hi, loWarn, hiWarn) => {
                    if (val == null) return "na";
                    if (val < lo || val > hi) return "abnormal";
                    if (val < loWarn || val > hiWarn) return "borderline";
                    return "normal";
                  };
                  const badgeLabel = { normal: "Normal", borderline: "Borderline", abnormal: "Abnormal", na: "—" };

                  const rows = [
                    hr  != null && { key: "hr",   label: "Heart Rate",     reading: `${hr} bpm`,              range: "60–100 bpm",      cls: badge(hr, 50, 110, 60, 100) },
                    sys != null && { key: "bp",   label: "Blood Pressure", reading: `${sys}${dia != null ? `/${dia}` : ""} mmHg`, range: "90–120 / 60–80 mmHg", cls: badge(sys, 80, 140, 90, 120) },
                    o2  != null && { key: "o2",   label: "O₂ Saturation",  reading: `${o2}%`,                 range: "95–100%",         cls: badge(o2, 90, 100, 95, 100) },
                    glu != null && { key: "glu",  label: "Blood Glucose",  reading: `${glu} mg/dL`,           range: "70–140 mg/dL",    cls: badge(glu, 60, 180, 70, 140) },
                    tmp != null && { key: "tmp",  label: "Temperature",    reading: `${tmp}°F`,               range: "97–99°F",         cls: badge(tmp, 95, 103, 97, 99) },
                    wt  != null && { key: "wt",   label: "Weight",         reading: `${wt} kg`,               range: "—",               cls: "na" },
                  ].filter(Boolean);

                  if (!rows.length) return null;
                  return (
                    <div style={{ borderTop: "1px solid var(--rule)" }}>
                      <table className="vitals-table">
                        <thead>
                          <tr>
                            <th>Vital Sign</th>
                            <th>Reading</th>
                            <th>Normal Range</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(r => (
                            <tr key={r.key}>
                              <td>{r.label}</td>
                              <td>{r.reading}</td>
                              <td>{r.range}</td>
                              <td><span className={`vitals-badge ${r.cls}`}>{badgeLabel[r.cls]}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="vitals-table-footer">Recorded {fmt(latestVitals.timestamp)}</div>
                    </div>
                  );
                })()}
              </div>

              {/* Clinical Notes — always visible under snapshot */}
              <div className="zone-label"><span>Clinical Notes</span><span style={{ color: "#bbb" }}>{selected.notes?.length || 0} note{selected.notes?.length !== 1 ? "s" : ""}</span></div>
              <div style={{ marginBottom: "1.25rem" }}>
                <div className="notes-input-row">
                  <textarea className="notes-textarea" placeholder="Add a clinical note… (Cmd+Enter to save)"
                    value={noteText} onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }} />
                  <button className="btn" style={{ alignSelf: "flex-end" }} onClick={submitNote} disabled={!noteText.trim()}>Add</button>
                </div>
                {(!selected.notes?.length) ? (
                  <div className="empty-sub">No notes yet</div>
                ) : (
                  [...(selected.notes || [])].reverse().map(n => (
                    <div key={n._id} className="note-item">
                      <div style={{ flex: 1 }}>
                        <div className="note-body">{n.text}</div>
                        <div className="note-meta">{fmt(n.created_at)}</div>
                      </div>
                      <button className="note-del" onClick={() => deleteNote(n._id)}>✕</button>
                    </div>
                  ))
                )}
              </div>

              {/* Agent Progress */}
              {loading && (
                <>
                  <div className="pulse-bar" />
                  <div className="agent-steps">
                    {AGENT_STEPS.map((step, i) => (
                      <div key={step} className={`agent-step ${i === activeStep ? "active" : i < activeStep ? "done" : ""}`}>
                        {i < activeStep ? "✓ " : i === activeStep ? "⟳ " : ""}{step}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════
                  ZONE B — LIVE WEB INTELLIGENCE
                  Only shown after analysis. Clearly separated.
              ═══════════════════════════════════════════════════ */}
              {report && (
                <>
                  <div className="zone-label">
                    <span>Live Web Intelligence</span>
                    <span className="live">● {fmt(report.generated_at)}</span>
                  </div>

                  {/* Clinical Brief — structured summary from coordinator */}
                  {summary && (
                    <div className="live-summary" style={{ marginBottom: "0.75rem" }}>
                      <div className="live-summary-header">
                        <span className="live-summary-title">📋 Clinical Brief</span>
                        <span className="live-summary-date">{fmt(report.generated_at)}</span>
                      </div>

                      {summary.findings?.length > 0 && (
                        <>
                          <div style={{ padding: "0.45rem 1rem", background: "var(--cream)", borderBottom: "1px solid var(--rule)", fontFamily: "var(--mono)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#999" }}>Key Findings</div>
                          <ul className="findings-list">
                            {summary.findings.map((f, i) => (
                              <li key={i}><span className="finding-num">{i + 1}.</span><span>{cleanText(f)}</span></li>
                            ))}
                          </ul>
                        </>
                      )}

                      {summary.nextSteps?.length > 0 && (
                        <>
                          <div style={{ padding: "0.45rem 1rem", background: "var(--cream)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", fontFamily: "var(--mono)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#999" }}>Action Steps</div>
                          <ul className="steps-list">
                            {summary.nextSteps.map((s, i) => {
                              const parts = cleanText(s).match(/^For (.+?) →\s*(.+)$/i);
                              return (
                                <li key={i}>
                                  <span className="step-num">{i + 1}</span>
                                  <span className="step-body">
                                    {parts ? <>For <span className="step-cond">{parts[1]}</span> <span style={{ color: "#bbb" }}>→</span> {parts[2]}</> : cleanText(s)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}

                      {summary.followUp && (
                        <div className="followup-bar">
                          <span className="followup-label">Follow-up</span>
                          <span>{cleanText(summary.followUp)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agent errors */}
                  {report.errors?.length > 0 && (
                    <div style={{ background: "#fff5f5", border: "1px solid #f5c6c6", borderRadius: "4px", padding: "0.65rem 0.9rem", marginBottom: "0.75rem" }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#c94f2e", marginBottom: "0.35rem", fontWeight: 600 }}>Agent Errors</div>
                      {report.errors.map((e, i) => (
                        <div key={i} style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "#b03a2a", lineHeight: 1.6 }}>{e}</div>
                      ))}
                    </div>
                  )}

                  {/* Agent Raw Intelligence Cards */}
                  <div className="agent-grid">
                    <div className="agent-card">
                      <div className="agent-card-hdr green">🔬 Research</div>
                      <div className="agent-card-body">{cleanText(report.research_findings?.[0] || "No findings")}</div>
                    </div>
                    <div className="agent-card">
                      <div className="agent-card-hdr amber">💊 Medication</div>
                      <div className="agent-card-body">{cleanText(report.medication_alerts?.[0] || "No alerts")}</div>
                    </div>
                    <div className="agent-card">
                      <div className="agent-card-hdr blue">🌍 Environment</div>
                      <div className="agent-card-body">{cleanText(report.environment_risks?.[0] || "No risks")}</div>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════════════
                  ZONE C — ANALYSIS HISTORY
              ═══════════════════════════════════════════════════ */}
              <div className="zone-label"><span>Analysis History</span><span style={{ color: "#bbb" }}>{history.length} record{history.length !== 1 ? "s" : ""}</span></div>
              {history.length === 0
                ? <div className="empty-sub">No past analyses yet</div>
                : history.map((h, i) => (
                  <div key={h._id || i} className="history-item" onClick={() => setExpandedHistory(expandedHistory === i ? null : i)}>
                    <div className="history-item-hdr">
                      <div className="history-item-date">{i === 0 && report ? "Latest · " : ""}{fmt(h.generated_at)}</div>
                      <div className="history-item-ago">{timeAgo(h.generated_at)} {expandedHistory === i ? "▲" : "▼"}</div>
                    </div>
                    {expandedHistory === i && <div className="history-item-body">{h.final_report || "No content"}</div>}
                  </div>
                ))
              }
            </>
          )}
        </main>
      </div>

      {/* Vitals Modal */}
      {showVitalsModal && (
        <div className="modal-overlay" onClick={() => setShowVitalsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Log Vitals — {selected?.name}</div>
            <div className="form-row">
              {[["Heart Rate (bpm)", "heart_rate"], ["BP Systolic (mmHg)", "blood_pressure_systolic"], ["BP Diastolic (mmHg)", "blood_pressure_diastolic"], ["Temperature (°F)", "temperature"], ["O₂ Saturation (%)", "oxygen_saturation"], ["Blood Glucose (mg/dL)", "blood_glucose"], ["Weight (kg)", "weight_kg"]].map(([label, key]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" type="number" value={newVitals[key]} onChange={e => setNewVitals(v => ({ ...v, [key]: e.target.value }))} placeholder="—" />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
              <button className="btn" onClick={submitVitals} disabled={Object.values(newVitals).every(v => v === "")}>Save Vitals</button>
              <button className="btn outline" onClick={() => setShowVitalsModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Patient Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingPatient(null); setNewPatient(EMPTY_P); setNewVitals(EMPTY_V); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingPatient ? `Edit — ${editingPatient.name}` : "Add New Patient"}</div>
            <div className="form-row">
              {[["Full Name", "name", "text"], ["Age", "age", "number"]].map(([label, key, type]) => (
                <div className="form-group" key={key}><label className="form-label">{label}</label>
                  <input className="form-input" type={type} value={newPatient[key]} onChange={e => setNewPatient(p => ({ ...p, [key]: e.target.value }))} placeholder={label} /></div>
              ))}
              <div className="form-group"><label className="form-label">Gender</label>
                <select className="form-input" value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value }))}>
                  <option>Female</option><option>Male</option><option>Other</option></select></div>
              <div className="form-group"><label className="form-label">Location</label>
                <input className="form-input" type="text" value={newPatient.location} onChange={e => setNewPatient(p => ({ ...p, location: e.target.value }))} placeholder="City, State" /></div>
            </div>
            <div className="form-group"><label className="form-label">Conditions (comma separated)</label>
              <input className="form-input" value={newPatient.conditions} onChange={e => setNewPatient(p => ({ ...p, conditions: e.target.value }))} placeholder="e.g. Breast Cancer Stage 2, Hypertension" /></div>
            <div className="form-group"><label className="form-label">Medications (comma separated)</label>
              <input className="form-input" value={newPatient.medications} onChange={e => setNewPatient(p => ({ ...p, medications: e.target.value }))} placeholder="e.g. Tamoxifen, Lisinopril" /></div>
            <div className="modal-divider">Initial Vitals (optional)</div>
            <div className="form-row">
              {[["Heart Rate (bpm)", "heart_rate"], ["BP Systolic", "blood_pressure_systolic"], ["BP Diastolic", "blood_pressure_diastolic"], ["Temperature (°F)", "temperature"], ["O₂ Sat (%)", "oxygen_saturation"], ["Glucose (mg/dL)", "blood_glucose"], ["Weight (kg)", "weight_kg"]].map(([label, key]) => (
                <div className="form-group" key={key}><label className="form-label">{label}</label>
                  <input className="form-input" type="number" value={newVitals[key]} onChange={e => setNewVitals(v => ({ ...v, [key]: e.target.value }))} placeholder="—" /></div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
              <button className="btn" onClick={savePatient} disabled={!newPatient.name}>{editingPatient ? "Save Changes" : "Add Patient"}</button>
              <button className="btn outline" onClick={() => { setShowModal(false); setEditingPatient(null); setNewPatient(EMPTY_P); setNewVitals(EMPTY_V); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}