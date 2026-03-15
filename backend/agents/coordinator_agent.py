"""
Agent 5 - Coordinator Agent
Synthesizes all agent findings into a unified patient health report.
This is the "brain" that ties everything together.
"""
import os
from datetime import datetime

from openai import OpenAI


class CoordinatorAgent:
    def __init__(self):
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, state: dict) -> str:
        patient_data = state.get("patient_data", {})
        research_findings = state.get("research_findings", [])
        medication_alerts = state.get("medication_alerts", [])
        environment_risks = state.get("environment_risks", [])
        monitor_summary = state.get("monitor_summary", "Not available")
        errors = state.get("errors", [])

        patient_name = patient_data.get("name", "Patient")
        patient_id = state.get("patient_id", "Unknown")

        research_text = "\n".join(
            research_findings) if research_findings else "No findings"
        medication_text = "\n".join(
            medication_alerts) if medication_alerts else "No alerts"
        environment_text = "\n".join(
            environment_risks) if environment_risks else "No risks identified"

        prompt = f"""
You are a senior physician AI assistant. Create a comprehensive daily health intelligence report
by synthesizing the findings from 4 specialized AI agents.

=== PATIENT: {patient_name} (ID: {patient_id}) ===
=== REPORT DATE: {datetime.now().strftime("%B %d, %Y at %H:%M")} ===

--- VITALS MONITORING (Agent 4) ---
{monitor_summary}

--- LATEST MEDICAL RESEARCH (Agent 1) ---
{research_text}

--- MEDICATION SAFETY (Agent 2) ---
{medication_text}

--- ENVIRONMENTAL HEALTH RISKS (Agent 3) ---
{environment_text}

--- SYSTEM ERRORS ---
{', '.join(errors) if errors else 'None'}

Create a final report with these exact sections:

## 🏥 PATIENT HEALTH INTELLIGENCE REPORT

### ⚡ Priority Alerts (if any - list only urgent items)

### 📊 Overall Health Status
(One paragraph summary)

### 💊 Medication Safety
(Key points from medication agent)

### 🔬 Condition-Specific Updates  
(Latest research relevant to this patient)

### 🌍 Environmental Factors Today
(Environmental risks relevant to patient)

### ✅ Recommended Actions for Care Team
(Numbered list, most urgent first)

### 📅 Follow-up Recommendations

Keep the tone professional, concise, and actionable for medical staff.
"""
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800
        )

        return response.choices[0].message.content
