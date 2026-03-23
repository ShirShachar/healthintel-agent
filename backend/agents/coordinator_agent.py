"""
Agent 5 - Coordinator Agent
Synthesizes all agent findings into a precise, clinical health report.
Output is specific to the patient's exact conditions, medications, and stage.
"""
import logging
import os
from datetime import datetime

from openai import OpenAI

logger = logging.getLogger("agent.coordinator")


class CoordinatorAgent:
    def __init__(self):
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, state: dict) -> str:
        logger.info("Synthesizing final report for patient_id=%s", state.get("patient_id"))
        patient_data = state.get("patient_data", {})
        research_findings = state.get("research_findings", [])
        medication_alerts = state.get("medication_alerts", [])
        environment_risks = state.get("environment_risks", [])
        monitor_summary = state.get("monitor_summary", "Not available")

        patient_name = patient_data.get("name", "Patient")
        patient_id = state.get("patient_id", "Unknown")
        age = patient_data.get("age", "unknown")
        gender = patient_data.get("gender", "unknown")
        location = patient_data.get("location", "unknown")
        conditions = patient_data.get("conditions", [])
        medications = patient_data.get("medications", [])
        vitals = patient_data.get("vitals", {})

        conditions_str = ", ".join(conditions) if conditions else "None listed"
        medications_str = ", ".join(
            medications) if medications else "None listed"
        vitals_str = "\n".join(
            [f"  - {k}: {v}" for k, v in vitals.items()]) if vitals else "  No vitals recorded"
        research_text = "\n".join(
            research_findings) if research_findings else "No findings"
        medication_text = "\n".join(
            medication_alerts) if medication_alerts else "No alerts"
        env_text = "\n".join(
            environment_risks) if environment_risks else "No risks"

        notes = patient_data.get("notes", [])
        notes_text = "\n".join(f"- {n}" for n in notes) if notes else "None"

        prompt = f"""
You are a senior physician writing a daily clinical brief for a hands-on care team (nurses, physicians, pharmacists).
The team needs actionable, specific detail — not summaries. Every section must reference actual data from the agent findings.
Never use vague language like "monitor closely" or "as appropriate". Always name the specific drug, condition, value, or threshold.

=== PATIENT ===
Name: {patient_name} | Age: {age} | Gender: {gender} | Location: {location}
Conditions: {conditions_str}
Medications: {medications_str}
Current Vitals:
{vitals_str}
Clinical Notes: {notes_text}
Report: {datetime.now().strftime("%B %d, %Y at %H:%M")}

=== AGENT FINDINGS ===
[VITALS ANALYSIS] {monitor_summary}
[RESEARCH] {research_text}
[MEDICATION SAFETY] {medication_text}
[ENVIRONMENT - {location}] {env_text}

---
Write EXACTLY this structure. Each section must be substantive — no placeholder text:

## 🏥 {patient_name} — Clinical Brief
**{datetime.now().strftime("%B %d, %Y · %H:%M")} · Live Intelligence**

### ⚡ STATUS
[Stable / Needs Attention / Critical] — [one sentence: name the specific condition and the exact data point (vital value, drug alert, or research finding) driving this assessment]

### 📋 KEY FINDINGS
• [Specific finding — name condition or drug, cite the value or fact. E.g. "Blood glucose at 187 mg/dL exceeds ADA target of <180 mg/dL post-meal for Type 2 Diabetes"]
• [Second finding — same specificity standard]
• [Third finding — same specificity standard]

### 💊 MEDICATIONS
Write one entry per medication in this list: {medications_str}
Format each as:
**[Drug]** — Role: [what it treats for THIS patient's specific condition and stage]. Status: [any active FDA alert, interaction risk, or "No current alerts"]. Watch: [the one monitoring parameter most relevant right now, with target value].

### 🔬 CONDITIONS
Write one entry per condition in this list: {conditions_str}
Format each as:
**[Condition]** [Controlled / Borderline / Uncontrolled] — [the specific vital or lab value supporting this assessment]. Research update: [the most specific finding from the research agent relevant to this condition — a threshold, guideline change, or clinical recommendation with a number or date].

### 📊 VITALS
For each vital that was recorded, one line:
[Vital name]: [value] → [normal range for this patient's age and conditions] → [clinical interpretation: normal / borderline / flag]
If no vitals recorded, write: No vitals recorded for this visit.

### 🌍 ENVIRONMENT — {location}
Risk level: [Low / Medium / High] — [specific environmental factor and why it matters for {patient_name}'s conditions by name].
Precaution: [one concrete action for today, tied to a named condition].

### ✅ NEXT STEPS
1. For [specific condition or drug] → [concrete action — include a target value, timeframe, or clinical threshold]
2. For [specific condition or drug] → [concrete action]
3. For [specific condition or drug] → [concrete action]
4. For environment/other → [concrete action]

---

### 📅 FOLLOW-UP BY CONDITION
Write one line per condition in this list: {conditions_str}
Format each as:
- **[Condition]** → [specific next appointment, lab test, or procedure recommended] within [concrete timeframe — e.g. 30 days, next visit, 60 days] — reason: [one sentence citing the specific finding or value that makes this the priority].
Base the timeframe and action on what the analysis actually found for that condition, not generic guidelines.
"""

        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500
        )

        logger.info("Coordinator agent done — report generated")
        return response.choices[0].message.content
