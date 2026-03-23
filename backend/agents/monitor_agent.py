"""
Agent 4 - Monitor Agent
Analyzes patient vitals trends against current medical benchmarks.
Uses research findings from Agent 1 to contextualize readings.
"""
import os
import logging

from openai import OpenAI
from tavily import TavilyClient

logger = logging.getLogger("agent.monitor")


class MonitorAgent:
    def __init__(self):
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, patient_data: dict, research_findings: list[str]) -> str:
        vitals = patient_data.get("vitals", {})
        conditions = patient_data.get("conditions", [])
        age = patient_data.get("age", "unknown")
        gender = patient_data.get("gender", "unknown")
        logger.info("Analyzing vitals for age=%s gender=%s conditions=%s vitals=%s",
                    age, gender, conditions, list(vitals.keys()))

        # 1. Search current clinical benchmarks for patient's age/conditions
        benchmark_results = self.tavily.search(
            query=f"normal vital signs ranges {' '.join(conditions)} {age} year old clinical guidelines",
            search_depth="advanced",
            include_domains=["mayoclinic.org",
                             "nih.gov", "heart.org", "diabetes.org"],
            max_results=3
        )

        benchmark_snippets = "\n".join(
            [r["content"] for r in benchmark_results.get("results", [])])
        research_context = "\n".join(
            research_findings[:2]) if research_findings else "No research context available"

        vitals_str = "\n".join(
            [f"- {k}: {v}" for k, v in vitals.items()]) if vitals else "No vitals recorded"
        notes = patient_data.get("notes", [])
        notes_str = "\n".join(f"- {n}" for n in notes) if notes else "None"

        prompt = f"""
You are a clinical monitoring specialist AI. Analyze the following patient vitals and flag any concerns.

Patient Profile:
- Age: {age}
- Gender: {gender}  
- Conditions: {', '.join(conditions) if conditions else 'None listed'}

Current Vitals:
{vitals_str}

Clinical Benchmarks (from current guidelines):
{benchmark_snippets}

Recent Research Context:
{research_context}

Clinical Notes:
{notes_str}

Provide a structured vitals analysis:
1. **Overall Status**: (Stable / Needs Attention / Critical)
2. **Vitals Assessment**: For each vital sign, note if it's within normal range
3. **Trending Concerns**: Any patterns that need monitoring
4. **Recommended Actions**: Specific next steps for the care team

Use ✅ for normal, ⚠️ for borderline, 🚨 for critical values.
Keep it concise and actionable for busy medical staff.
"""
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500
        )

        summary = response.choices[0].message.content
        logger.info("Monitor agent done")
        return summary
