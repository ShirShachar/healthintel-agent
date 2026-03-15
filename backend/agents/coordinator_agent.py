"""
Agent 5 - Coordinator Agent
Synthesizes all agent findings into a precise, clinical health report.
Output is specific to the patient's exact conditions, medications, and stage.
"""
from openai import OpenAI
from datetime import datetime
import os


class CoordinatorAgent:
    def __init__(self):
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, state: dict) -> str:
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

        prompt = f"""
You are a senior physician AI assistant writing a daily clinical intelligence brief for a care team.
Be PRECISE, SPECIFIC, and ACTIONABLE. Reference the patient's EXACT conditions, medications by name.
Never write generic advice. Every recommendation must name the specific condition or drug it refers to.
Consider disease STAGE and progression when relevant.

=== PATIENT ===
Name: {patient_name} | Age: {age} | Gender: {gender} | Location: {location}
Conditions: {conditions_str}
Medications: {medications_str}
Vitals:
{vitals_str}
Report: {datetime.now().strftime("%B %d, %Y at %H:%M")}

=== AGENT FINDINGS ===
[VITALS] {monitor_summary}
[RESEARCH] {research_text}
[MEDICATIONS] {medication_text}
[ENVIRONMENT - {location}] {env_text}

Write this EXACT structure — specific, no generic advice:

## 🏥 {patient_name} — Clinical Brief
**{datetime.now().strftime("%B %d, %Y · %H:%M")} · Live Data**

### ⚡ STATUS
[One line: Stable/Needs Attention/Critical + ONE specific reason naming the condition]

### 📋 KEY FINDINGS
• [Finding about specific condition or medication — under 20 words]
• [Finding about specific condition or medication — under 20 words]
• [Finding about specific condition or medication — under 20 words]

### 💊 MEDICATION BRIEF
[2-3 sentences. Name each medication. State purpose for THIS patient's disease stage. Flag interactions. Confirm FDA clearance.]

### 🔬 CONDITION UPDATES
[One bullet per condition. Name condition + stage if relevant. State specific 2025 guideline finding.]

### 🌍 ENVIRONMENT — {location}
[1-2 lines. Specific risks for THIS patient's conditions. Include AQI if available.]

### ✅ NEXT STEPS
1. For [Condition/Med] → [Specific action with data point]
2. For [Condition/Med] → [Specific action with data point]
3. For [Condition/Med] → [Specific action with data point]
4. For environment → [Specific action relevant to patient's conditions]

### 📅 FOLLOW-UP
[Next appointment timeframe + ONE specific priority test or check]
"""

        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )

        return response.choices[0].message.content
