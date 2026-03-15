import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// MongoDB returns UTC datetimes without Z — append it so JS parses correctly
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
  .masthead-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
  .masthead-sub { font-family: var(--mono); font-size: 0.65rem; color: #888; letter-spacing: 0.1em; text-transform: uppercase; }
  .live-badge { font-family: var(--mono); font-size: 0.62rem; color: var(--green); background: var(--green-pale); border: 1px solid var(--green); padding: 0.15rem 0.5rem; border-radius: 20px; display: flex; align-items: center; gap: 0.3rem; }
  .live-dot { width: 6px; height: 6px; background: var(--green); border-radius: 50%; animation: blink 1.5s ease-in-out infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

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

  .main { padding: 1.75rem 2rem; overflow-y: auto; }

  .patient-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); }
  .patient-name { font-family: var(--serif); font-size: 1.6rem; letter-spacing: -0.01em; margin-bottom: 0.25rem; }
  .patient-subtitle { font-family: var(--mono); font-size: 0.68rem; color: #999; }
  .btn-row { display: flex; gap: 0.6rem; align-items: center; }

  .btn { font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.55rem 1.1rem; border: 1.5px solid var(--ink); border-radius: 3px; background: var(--ink); color: var(--paper); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn:hover { background: #2a2a2a; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.outline { background: transparent; color: var(--ink); }
  .btn.outline:hover { background: var(--ink); color: var(--paper); }

  /* Demographics strip */
  .demo-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
  .demo-cell { background: var(--cream); border: 1px solid var(--rule); border-radius: 4px; padding: 0.65rem 0.85rem; }
  .demo-cell-label { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: #999; margin-bottom: 0.25rem; }
  .demo-cell-value { font-size: 0.88rem; font-weight: 600; }

  /* Conditions + Meds row */
  .demo-tags-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; }
  .demo-tags-box { background: var(--cream); border: 1px solid var(--rule); border-radius: 4px; padding: 0.75rem 0.9rem; }
  .demo-tags-title { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; }

  /* Agent progress */
  .pulse-bar { height: 3px; background: linear-gradient(90deg, var(--accent), var(--amber), var(--green), var(--accent)); background-size: 200% 100%; animation: pulse 1.5s linear infinite; border-radius: 2px; margin-bottom: 1rem; }
  @keyframes pulse { to { background-position: -200% 0; } }
  .agent-steps { display: flex; gap: 0.4rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .agent-step { font-family: var(--mono); font-size: 0.62rem; padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid var(--rule); color: #999; background: var(--cream); transition: all 0.3s; }
  .agent-step.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .agent-step.done { background: var(--green-pale); color: var(--green); border-color: var(--green); }

  /* Summary card */
  .summary-card { border: 2px solid var(--ink); border-radius: 6px; overflow: hidden; margin-bottom: 1.25rem; }
  .summary-card-header { background: var(--ink); color: var(--paper); padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; }
  .summary-card-title { font-family: var(--serif); font-size: 1rem; }
  .summary-card-date { font-family: var(--mono); font-size: 0.65rem; opacity: 0.6; }
  .summary-card-body { padding: 1.25rem; background: var(--paper); display: flex; flex-direction: column; gap: 1rem; }
  .status-row { display: flex; align-items: center; gap: 0.75rem; }
  .status-badge { font-family: var(--mono); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.25rem 0.75rem; border-radius: 20px; white-space: nowrap; }
  .status-badge.stable { background: var(--green-pale); color: var(--green); border: 1px solid var(--green); }
  .status-badge.attention { background: var(--amber-pale); color: var(--amber); border: 1px solid var(--amber); }
  .status-badge.critical { background: var(--accent-pale); color: var(--accent); border: 1px solid var(--accent); }
  .status-reason { font-size: 0.85rem; line-height: 1.5; color: #444; }
  .summary-block { }
  .summary-block-label { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--rule); }
  .findings-list { list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
  .findings-list li { font-size: 0.82rem; line-height: 1.55; padding: 0.4rem 0.6rem; background: var(--cream); border-radius: 3px; border-left: 3px solid var(--ink); }
  .next-steps { list-style: none; display: flex; flex-direction: column; gap: 0.3rem; }
  .next-steps li { font-size: 0.82rem; line-height: 1.55; padding: 0.4rem 0.6rem; background: var(--cream); border-radius: 3px; display: flex; gap: 0.5rem; align-items: flex-start; }
  .step-num { font-family: var(--mono); font-size: 0.62rem; background: var(--ink); color: var(--paper); width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 0.15rem; }
  .step-cond { color: var(--blue); font-weight: 600; }
  .followup-row { font-family: var(--mono); font-size: 0.75rem; color: #666; background: var(--cream); padding: 0.5rem 0.75rem; border-radius: 3px; }
  .agent-details-toggle { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: #999; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0; border: none; background: none; }
  .agent-details-toggle:hover { color: var(--ink); }

  /* Agent cards row */
  .agent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
  .agent-card { border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; }
  .agent-card-header { padding: 0.55rem 0.9rem; font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; display: flex; align-items: center; gap: 0.4rem; }
  .agent-card-header.green { background: var(--green); color: var(--paper); }
  .agent-card-header.amber { background: var(--amber); color: var(--paper); }
  .agent-card-header.red { background: var(--accent); color: var(--paper); }
  .agent-card-body { padding: 0.9rem; font-size: 0.78rem; line-height: 1.65; white-space: pre-wrap; background: var(--paper); max-height: 140px; overflow-y: auto; }

  .vitals-card { border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; margin-bottom: 1rem; }
  .vitals-card-header { padding: 0.55rem 0.9rem; background: var(--blue); color: var(--paper); font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .vitals-card-body { padding: 0.9rem; font-size: 0.82rem; line-height: 1.7; white-space: pre-wrap; background: var(--paper); }

  /* History section */
  .history-section { margin-top: 1.5rem; }
  .history-header { font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 0.75rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; }
  .history-item { border: 1px solid var(--rule); border-radius: 4px; margin-bottom: 0.5rem; overflow: hidden; cursor: pointer; background: var(--paper); transition: border-color 0.15s; }
  .history-item:hover { border-color: var(--ink); }
  .history-item-header { padding: 0.65rem 1rem; display: flex; justify-content: space-between; align-items: center; background: var(--cream); }
  .history-item-date { font-family: var(--mono); font-size: 0.68rem; font-weight: 500; }
  .history-item-ago { font-family: var(--mono); font-size: 0.62rem; color: #999; }
  .history-item-body { padding: 0.9rem 1rem; font-size: 0.8rem; line-height: 1.65; white-space: pre-wrap; border-top: 1px solid var(--rule); max-height: 200px; overflow-y: auto; }
  .history-empty { font-family: var(--mono); font-size: 0.72rem; color: #bbb; padding: 1rem 0; }

  .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { text-align: center; padding: 4rem 2rem; color: #aaa; }
  .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.4; }
  .empty-text { font-family: var(--serif); font-size: 1.1rem; font-style: italic; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(15,17,23,0.55); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
  .modal { background: var(--paper); border: 1.5px solid var(--ink); border-radius: 6px; width: 600px; max-height: 85vh; overflow-y: auto; padding: 1.75rem; }
  .modal-title { font-family: var(--serif); font-size: 1.3rem; margin-bottom: 1.25rem; padding-bottom: 0.65rem; border-bottom: 1px solid var(--rule); }
  .form-group { margin-bottom: 0.85rem; }
  .form-label { display: block; font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: #777; margin-bottom: 0.35rem; }
  .form-input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid var(--rule); border-radius: 3px; font-family: var(--sans); font-size: 0.85rem; background: var(--paper); color: var(--ink); transition: border-color 0.15s; }
  .form-input:focus { outline: none; border-color: var(--ink); }

  .section-divider { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: #bbb; margin: 1.25rem 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--rule); }

  .vitals-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
  .vital-cell { background: var(--cream); border: 1px solid var(--rule); border-radius: 4px; padding: 0.65rem 0.85rem; }
  .vital-cell-label { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: #999; margin-bottom: 0.25rem; }
  .vital-cell-value { font-size: 0.95rem; font-weight: 600; }
  .vital-cell-unit { font-family: var(--mono); font-size: 0.6rem; color: #aaa; margin-left: 0.2rem; }
  .vital-cell-empty { color: #ccc; font-size: 0.85rem; }
  .vitals-section-header { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 0.6rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

  .notes-section { margin-bottom: 1.25rem; }
  .notes-input-row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  .notes-textarea { flex: 1; padding: 0.55rem 0.75rem; border: 1px solid var(--rule); border-radius: 3px; font-family: var(--sans); font-size: 0.82rem; background: var(--paper); color: var(--ink); resize: none; height: 60px; transition: border-color 0.15s; }
  .notes-textarea:focus { outline: none; border-color: var(--ink); }
  .note-item { border: 1px solid var(--rule); border-radius: 4px; padding: 0.65rem 0.9rem; margin-bottom: 0.4rem; background: var(--paper); display: flex; gap: 0.75rem; align-items: flex-start; }
  .note-item-body { flex: 1; font-size: 0.82rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .note-item-meta { font-family: var(--mono); font-size: 0.6rem; color: #aaa; margin-top: 0.25rem; }
  .note-delete { font-family: var(--mono); font-size: 0.65rem; color: #ccc; background: none; border: none; cursor: pointer; padding: 0.15rem 0.3rem; border-radius: 2px; flex-shrink: 0; }
  .note-delete:hover { color: var(--accent); background: var(--accent-pale); }
`;

export default function App() {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null); // null = adding, patient obj = editing
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [now, setNow] = useState(new Date());
  const EMPTY_PATIENT = { name: "", age: "", gender: "Female", location: "", conditions: "", medications: "" };
  const EMPTY_VITALS = { heart_rate: "", blood_pressure_systolic: "", blood_pressure_diastolic: "", temperature: "", oxygen_saturation: "", blood_glucose: "", weight_kg: "" };
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT);
  const [newVitals, setNewVitals] = useState(EMPTY_VITALS);
  const [noteText, setNoteText] = useState("");

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Load patients on mount
  useEffect(() => {
    fetch(`${API_BASE}/patients`)
      .then(r => r.json())
      .then(d => setPatients(d.patients || []))
      .catch(() => { });
  }, []);

  // Load full patient + history when patient selected
  useEffect(() => {
    if (!selected?._id) return;
    setHistory([]);
    setReport(null);
    fetch(`${API_BASE}/patients/${selected._id}`)
      .then(r => r.json())
      .then(p => {
        setSelected(p);
        if (p.last_report?.final_report) setReport(p.last_report);
      })
      .catch(() => { });
    fetch(`${API_BASE}/patients/${selected._id}/reports?limit=10`)
      .then(r => r.json())
      .then(d => setHistory(d.reports || []))
      .catch(() => { });
  }, [selected?._id]);

  const runAnalysis = async () => {
    if (!selected) return;
    setLoading(true);
    setReport(null);
    setActiveStep(0);

    for (let i = 0; i < AGENT_STEPS.length; i++) {
      setActiveStep(i);
      await new Promise(r => setTimeout(r, 900));
    }

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: selected._id }),
      });
      const data = await res.json();
      const reportWithDate = { ...data, generated_at: new Date().toISOString() };
      setReport(reportWithDate);
      // Prepend to history
      setHistory(prev => [{ _id: data.report_id, final_report: data.final_report, generated_at: reportWithDate.generated_at }, ...prev]);
      // Refresh patient to pick up last_analyzed
      fetch(`${API_BASE}/patients/${selected._id}`)
        .then(r => r.json())
        .then(p => {
          setSelected(p);
          setPatients(prev => prev.map(x => x._id === p._id ? p : x));
        }).catch(() => { });
    } catch {
      console.error("Analysis failed");
    }

    setLoading(false);
    setActiveStep(-1);
  };

  const savePatient = async () => {
    const body = {
      name: newPatient.name,
      age: parseInt(newPatient.age),
      gender: newPatient.gender,
      location: newPatient.location,
      conditions: newPatient.conditions.split(",").map(s => s.trim()).filter(Boolean),
      medications: newPatient.medications.split(",").map(s => s.trim()).filter(Boolean),
    };
    const vitalsBody = Object.fromEntries(
      Object.entries(newVitals).filter(([, v]) => v !== "").map(([k, v]) => [k, parseFloat(v)])
    );

    if (editingPatient) {
      // Update existing patient
      await fetch(`${API_BASE}/patients/${editingPatient._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).catch(() => {});
      if (Object.keys(vitalsBody).length > 0) {
        await fetch(`${API_BASE}/patients/${editingPatient._id}/vitals`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vitalsBody),
        }).catch(() => {});
      }
      const updated = await fetch(`${API_BASE}/patients/${editingPatient._id}`).then(r => r.json()).catch(() => null);
      if (updated) {
        setSelected(updated);
        setPatients(prev => prev.map(p => p._id === updated._id ? updated : p));
      }
    } else {
      // Create new patient
      try {
        const res = await fetch(`${API_BASE}/patients`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json();
        const newP = { _id: data.patient_id, ...body };
        if (Object.keys(vitalsBody).length > 0) {
          await fetch(`${API_BASE}/patients/${data.patient_id}/vitals`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vitalsBody),
          }).catch(() => {});
        }
        setPatients(prev => [newP, ...prev]);
        setSelected(newP);
      } catch {
        const newP = { _id: `local_${Date.now()}`, ...body };
        setPatients(prev => [newP, ...prev]);
        setSelected(newP);
      }
    }
    setShowModal(false);
    setEditingPatient(null);
    setNewPatient(EMPTY_PATIENT);
    setNewVitals(EMPTY_VITALS);
  };

  const submitVitals = async () => {
    const body = Object.fromEntries(
      Object.entries(newVitals)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => [k, parseFloat(v)])
    );
    try {
      await fetch(`${API_BASE}/patients/${selected._id}/vitals`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      // Refresh full patient to pick up new vitals_history
      fetch(`${API_BASE}/patients/${selected._id}`)
        .then(r => r.json())
        .then(p => setSelected(p))
        .catch(() => { });
    } catch { console.error("Vitals submission failed"); }
    setShowVitalsModal(false);
    setNewVitals(EMPTY_VITALS);
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    await fetch(`${API_BASE}/patients/${selected._id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText.trim() }),
    }).catch(() => {});
    setNoteText("");
    fetch(`${API_BASE}/patients/${selected._id}`).then(r => r.json()).then(p => {
      setSelected(p);
      setPatients(prev => prev.map(x => x._id === p._id ? p : x));
    }).catch(() => {});
  };

  const deleteNoteById = async (noteId) => {
    await fetch(`${API_BASE}/patients/${selected._id}/notes/${noteId}`, { method: "DELETE" }).catch(() => {});
    fetch(`${API_BASE}/patients/${selected._id}`).then(r => r.json()).then(p => {
      setSelected(p);
      setPatients(prev => prev.map(x => x._id === p._id ? p : x));
    }).catch(() => {});
  };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([report.final_report], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selected?.name?.replace(" ", "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  const parseSummary = (text) => {
    if (!text) return null;
    const block = text.match(/###[^#]*SUMMARY([\s\S]*?)(?=###|$)/i)?.[1] || "";

    const statusLine = block.match(/\*\*Status:\*\*\s*(.+)/i)?.[1]?.trim() || null;
    const statusLevel = !statusLine ? "stable"
      : /critical/i.test(statusLine) ? "critical"
      : /attention|monitor|concern/i.test(statusLine) ? "attention"
      : "stable";
    const statusLabel = statusLevel === "critical" ? "Critical"
      : statusLevel === "attention" ? "Needs Attention" : "Stable";
    const statusReason = statusLine?.replace(/^(stable|needs attention|critical)\s*[—–-]\s*/i, "").trim() || "";

    const findingsBlock = block.match(/\*\*Top 3 Findings[^*]*\*\*([\s\S]*?)(?=\*\*Next Steps|\*\*Follow)/i)?.[1] || "";
    const findings = [...findingsBlock.matchAll(/^\d+\.\s*(.+)/gm)].map(m => m[1].trim()).slice(0, 3);

    const stepsBlock = block.match(/\*\*Next Steps[^*]*\*\*([\s\S]*?)(?=\*\*Follow)/i)?.[1] || "";
    const nextSteps = [...stepsBlock.matchAll(/^\d+\.\s*(.+)/gm)].map(m => m[1].trim()).slice(0, 4);

    const followUp = block.match(/\*\*Follow-up[^:*]*:?\*\*\s*(.+)/i)?.[1]?.trim() || null;

    return { statusLevel, statusLabel, statusReason, findings, nextSteps, followUp };
  };

  return (
    <>
      <style>{css}</style>

      <header className="masthead">
        <div className="masthead-title">HealthIntel</div>
        <div className="masthead-right">
          <div className="live-badge">
            <div className="live-dot" />
            Live · {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="masthead-sub">Tavily + LangGraph · Multi-Agent Intelligence</div>
        </div>
      </header>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-label">Patients ({patients.length})</div>
          {patients.map(p => (
            <div key={p._id} className={`patient-card ${selected?._id === p._id ? "active" : ""}`}
              onClick={() => { setSelected(p); setReport(null); setShowAgentDetails(false); }}>
              <div className="patient-card-name">{p.name}</div>
              <div className="patient-card-meta">{p.age}y · {p.gender || "—"} · {p.location || "—"}</div>
              <div style={{ marginTop: "0.3rem" }}>
                {p.conditions?.slice(0, 2).map(c => <span key={c} className="tag cond">{c}</span>)}
              </div>
              {p.last_analyzed && (
                <div className="patient-card-analyzed">● Analyzed {timeAgo(p.last_analyzed)}</div>
              )}
            </div>
          ))}
          <button className="btn outline" style={{ width: "100%", marginTop: "0.6rem" }} onClick={() => setShowModal(true)}>
            + Add Patient
          </button>
        </aside>

        {/* Main */}
        <main className="main">
          {!selected ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <div className="empty-text">Select a patient to begin</div>
            </div>
          ) : (
            <>
              {/* Patient Header */}
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
                    setNewPatient({
                      name: selected.name || "",
                      age: selected.age?.toString() || "",
                      gender: selected.gender || "Female",
                      location: selected.location || "",
                      conditions: selected.conditions?.join(", ") || "",
                      medications: selected.medications?.join(", ") || "",
                    });
                    setNewVitals(EMPTY_VITALS);
                    setShowModal(true);
                  }}>✎ Edit</button>
                  <button className="btn outline" onClick={() => setShowVitalsModal(true)}>+ Log Vitals</button>
                  <button className="btn" onClick={runAnalysis} disabled={loading}>
                    {loading ? <><span className="spinner" />&nbsp; Analyzing…</> : "▶ Run Analysis"}
                  </button>
                </div>
              </div>

              {/* Demographics Strip */}
              <div className="demo-strip">
                <div className="demo-cell">
                  <div className="demo-cell-label">Age</div>
                  <div className="demo-cell-value">{selected.age || "—"}</div>
                </div>
                <div className="demo-cell">
                  <div className="demo-cell-label">Gender</div>
                  <div className="demo-cell-value">{selected.gender || "—"}</div>
                </div>
                <div className="demo-cell">
                  <div className="demo-cell-label">Location</div>
                  <div className="demo-cell-value" style={{ fontSize: "0.78rem" }}>{selected.location || "—"}</div>
                </div>
                <div className="demo-cell">
                  <div className="demo-cell-label">Conditions</div>
                  <div className="demo-cell-value">{selected.conditions?.length || 0}</div>
                </div>
                <div className="demo-cell">
                  <div className="demo-cell-label">Medications</div>
                  <div className="demo-cell-value">{selected.medications?.length || 0}</div>
                </div>
              </div>

              {/* Conditions + Medications */}
              <div className="demo-tags-row">
                <div className="demo-tags-box">
                  <div className="demo-tags-title">Conditions</div>
                  {selected.conditions?.map(c => <span key={c} className="tag cond">{c}</span>)}
                  {!selected.conditions?.length && <span style={{ fontSize: "0.78rem", color: "#aaa" }}>None recorded</span>}
                </div>
                <div className="demo-tags-box">
                  <div className="demo-tags-title">Medications</div>
                  {selected.medications?.map(m => <span key={m} className="tag med">{m}</span>)}
                  {!selected.medications?.length && <span style={{ fontSize: "0.78rem", color: "#aaa" }}>None recorded</span>}
                </div>
              </div>

              {/* Latest Vitals */}
              {(() => {
                const latest = selected.vitals_history?.[selected.vitals_history.length - 1];
                return (
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div className="vitals-section-header">
                      <span>Latest Vitals {latest && <span style={{ color: "#bbb", fontWeight: 400 }}>· {fmt(latest.timestamp)}</span>}</span>
                      <span style={{ color: "#bbb" }}>{selected.vitals_history?.length || 0} reading{selected.vitals_history?.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="vitals-grid">
                      {[
                        { label: "Heart Rate", key: "heart_rate", unit: "bpm" },
                        { label: "BP Systolic", key: "blood_pressure_systolic", unit: "mmHg" },
                        { label: "BP Diastolic", key: "blood_pressure_diastolic", unit: "mmHg" },
                        { label: "Temperature", key: "temperature", unit: "°F" },
                        { label: "O₂ Saturation", key: "oxygen_saturation", unit: "%" },
                        { label: "Blood Glucose", key: "blood_glucose", unit: "mg/dL" },
                        { label: "Weight", key: "weight_kg", unit: "kg" },
                      ].map(({ label, key, unit }) => (
                        <div key={key} className="vital-cell">
                          <div className="vital-cell-label">{label}</div>
                          {latest?.[key] != null
                            ? <div className="vital-cell-value">{latest[key]}<span className="vital-cell-unit">{unit}</span></div>
                            : <div className="vital-cell-empty">—</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              <div className="notes-section">
                <div className="vitals-section-header">
                  <span>Notes</span>
                  <span style={{ color: "#bbb" }}>{selected.notes?.length || 0} note{selected.notes?.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="notes-input-row">
                  <textarea
                    className="notes-textarea"
                    placeholder="Add a clinical note…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }}
                  />
                  <button className="btn" style={{ alignSelf: "flex-end" }} onClick={submitNote} disabled={!noteText.trim()}>
                    Add
                  </button>
                </div>
                {selected.notes?.length === 0 || !selected.notes ? (
                  <div className="history-empty">No notes yet</div>
                ) : (
                  [...(selected.notes || [])].reverse().map(n => (
                    <div key={n._id} className="note-item">
                      <div style={{ flex: 1 }}>
                        <div className="note-item-body">{n.text}</div>
                        <div className="note-item-meta">{fmt(n.created_at)}</div>
                      </div>
                      <button className="note-delete" onClick={() => deleteNoteById(n._id)} title="Delete note">✕</button>
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

              {/* Report */}
              {report && (() => {
                const summary = parseSummary(report.final_report);
                return (
                  <>
                    <div className="summary-card">
                      <div className="summary-card-header">
                        <div className="summary-card-title">📋 Clinical Brief — {selected.name}</div>
                        <div className="summary-card-date">Live · {fmt(report.generated_at)}</div>
                      </div>
                      <div className="summary-card-body">

                        {/* Status */}
                        {summary ? (
                          <div className="status-row">
                            <span className={`status-badge ${summary.statusLevel}`}>{summary.statusLabel}</span>
                            {summary.statusReason && <span className="status-reason">{summary.statusReason}</span>}
                          </div>
                        ) : (
                          <div className="status-reason">{report.monitor_summary || "Analysis complete."}</div>
                        )}

                        {/* Top 3 Findings */}
                        {summary?.findings?.length > 0 && (
                          <div className="summary-block">
                            <div className="summary-block-label">Top Findings</div>
                            <ul className="findings-list">
                              {summary.findings.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Next Steps */}
                        {summary?.nextSteps?.length > 0 && (
                          <div className="summary-block">
                            <div className="summary-block-label">Next Steps</div>
                            <ol className="next-steps">
                              {summary.nextSteps.map((s, i) => {
                                const parts = s.match(/^For (.+?) →\s*(.+)$/i);
                                return (
                                  <li key={i}>
                                    <span className="step-num">{i + 1}</span>
                                    {parts
                                      ? <span>For <span className="step-cond">{parts[1]}</span> → {parts[2]}</span>
                                      : <span>{s}</span>}
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        )}

                        {/* Follow-up */}
                        {summary?.followUp && (
                          <div className="followup-row">📅 Follow-up: {summary.followUp}</div>
                        )}
                      </div>
                    </div>

                    {/* Agent source details toggle */}
                    <button className="agent-details-toggle" onClick={() => setShowAgentDetails(v => !v)}>
                      {showAgentDetails ? "▲ Hide" : "▼ Show"} agent source data
                    </button>

                    {showAgentDetails && (
                      <>
                        <div className="agent-grid" style={{ marginTop: "0.5rem" }}>
                          <div className="agent-card">
                            <div className="agent-card-header green">🔬 Research</div>
                            <div className="agent-card-body">{report.research_findings?.[0] || "No findings"}</div>
                          </div>
                          <div className="agent-card">
                            <div className="agent-card-header amber">💊 Medication</div>
                            <div className="agent-card-body">{report.medication_alerts?.[0] || "No alerts"}</div>
                          </div>
                          <div className="agent-card">
                            <div className="agent-card-header red">🌍 Environment</div>
                            <div className="agent-card-body">{report.environment_risks?.[0] || "No risks"}</div>
                          </div>
                        </div>
                        <div className="vitals-card">
                          <div className="vitals-card-header">📊 Vitals Monitor</div>
                          <div className="vitals-card-body">{report.monitor_summary || "No vitals data"}</div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

              {/* Analysis History */}
              <div className="history-section">
                <div className="history-header">
                  <span>Analysis History</span>
                  <span style={{ color: "#bbb" }}>{history.length} record{history.length !== 1 ? "s" : ""}</span>
                </div>
                {history.length === 0 && (
                  <div className="history-empty">No past analyses — run the first analysis above</div>
                )}
                {history.map((h, i) => (
                  <div key={h._id || i} className="history-item" onClick={() => setExpandedHistory(expandedHistory === i ? null : i)}>
                    <div className="history-item-header">
                      <div>
                        <div className="history-item-date">
                          {i === 0 && report ? "▼ Latest — " : ""}
                          {fmt(h.generated_at)}
                        </div>
                      </div>
                      <div className="history-item-ago">{timeAgo(h.generated_at)} {expandedHistory === i ? "▲" : "▼"}</div>
                    </div>
                    {expandedHistory === i && (
                      <div className="history-item-body">{h.final_report || "No report content"}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Log Vitals Modal */}
      {showVitalsModal && (
        <div className="modal-overlay" onClick={() => setShowVitalsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Log Vitals — {selected?.name}</div>
            <div className="form-row">
              {[
                { label: "Heart Rate (bpm)", key: "heart_rate" },
                { label: "BP Systolic (mmHg)", key: "blood_pressure_systolic" },
                { label: "BP Diastolic (mmHg)", key: "blood_pressure_diastolic" },
                { label: "Temperature (°F)", key: "temperature" },
                { label: "O₂ Saturation (%)", key: "oxygen_saturation" },
                { label: "Blood Glucose (mg/dL)", key: "blood_glucose" },
                { label: "Weight (kg)", key: "weight_kg" },
              ].map(({ label, key }) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" type="number" value={newVitals[key]}
                    onChange={e => setNewVitals(v => ({ ...v, [key]: e.target.value }))} placeholder="—" />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
              <button className="btn" onClick={submitVitals}
                disabled={Object.values(newVitals).every(v => v === "")}>
                Save Vitals
              </button>
              <button className="btn outline" onClick={() => setShowVitalsModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Patient Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingPatient(null); setNewPatient(EMPTY_PATIENT); setNewVitals(EMPTY_VITALS); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingPatient ? `Edit Patient — ${editingPatient.name}` : "Add New Patient"}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" type="text" value={newPatient.name}
                  onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))} placeholder="Full Name" />
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-input" type="number" value={newPatient.age}
                  onChange={e => setNewPatient(p => ({ ...p, age: e.target.value }))} placeholder="Age" />
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-input" value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value }))}>
                  <option>Female</option><option>Male</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Location (City, State)</label>
                <input className="form-input" type="text" value={newPatient.location}
                  onChange={e => setNewPatient(p => ({ ...p, location: e.target.value }))} placeholder="City, State" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Conditions (comma separated)</label>
              <input className="form-input" type="text" value={newPatient.conditions}
                onChange={e => setNewPatient(p => ({ ...p, conditions: e.target.value }))} placeholder="e.g. Diabetes, Hypertension" />
            </div>
            <div className="form-group">
              <label className="form-label">Medications (comma separated)</label>
              <input className="form-input" type="text" value={newPatient.medications}
                onChange={e => setNewPatient(p => ({ ...p, medications: e.target.value }))} placeholder="e.g. Metformin, Lisinopril" />
            </div>
            <div className="section-divider">Vitals (optional)</div>
            <div className="form-row">
              {[
                { label: "Heart Rate (bpm)", key: "heart_rate" },
                { label: "BP Systolic (mmHg)", key: "blood_pressure_systolic" },
                { label: "BP Diastolic (mmHg)", key: "blood_pressure_diastolic" },
                { label: "Temperature (°F)", key: "temperature" },
                { label: "O₂ Saturation (%)", key: "oxygen_saturation" },
                { label: "Blood Glucose (mg/dL)", key: "blood_glucose" },
                { label: "Weight (kg)", key: "weight_kg" },
              ].map(({ label, key }) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" type="number" value={newVitals[key]}
                    onChange={e => setNewVitals(v => ({ ...v, [key]: e.target.value }))} placeholder="—" />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
              <button className="btn" onClick={savePatient} disabled={!newPatient.name}>
                {editingPatient ? "Save Changes" : "Add Patient"}
              </button>
              <button className="btn outline" onClick={() => { setShowModal(false); setEditingPatient(null); setNewPatient(EMPTY_PATIENT); setNewVitals(EMPTY_VITALS); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}