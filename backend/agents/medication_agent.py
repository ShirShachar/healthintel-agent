"""
Agent 2 - Medication Agent
Checks real-time FDA alerts, drug interactions, and medication warnings.
Uses Tavily: search + crawl
"""
import os
import logging

from openai import OpenAI
from tavily import TavilyClient

logger = logging.getLogger("agent.medication")


class MedicationAgent:
    def __init__(self):
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, patient_data: dict) -> list[str]:
        medications = patient_data.get("medications", [])
        logger.info("Checking medications: %s", medications)
        alerts = []

        if not medications:
            logger.info("No medications listed — skipping")
            return ["No medications listed for this patient."]

        meds_str = ", ".join(medications)

        # 1. Search FDA alerts for patient's medications
        fda_results = self.tavily.search(
            query=f"FDA drug alert warning recall {meds_str} 2024 2025",
            search_depth="advanced",
            include_domains=["fda.gov", "drugs.com", "medscape.com"],
            max_results=5
        )

        # 2. Search drug interactions
        interaction_results = self.tavily.search(
            query=f"drug interaction {meds_str}",
            search_depth="advanced",
            include_domains=["drugs.com", "rxlist.com", "medlineplus.gov"],
            max_results=3
        )

        # 3. Crawl FDA MedWatch for latest safety alerts
        try:
            crawl_results = self.tavily.crawl(
                url="https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program",
                max_depth=1,
                max_pages=2
            )
            fda_live = crawl_results.get("results", [{}])[
                0].get("raw_content", "")[:1000]
        except Exception:
            fda_live = ""

        # 4. LLM analyzes for this specific patient
        fda_snippets = "\n".join([r["content"]
                                 for r in fda_results.get("results", [])])
        interaction_snippets = "\n".join(
            [r["content"] for r in interaction_results.get("results", [])])

        prompt = f"""
You are a clinical pharmacist AI assistant. Analyze the following information for a patient 
taking these medications: {meds_str}

FDA Alerts & Warnings:
{fda_snippets}

Drug Interaction Data:
{interaction_snippets}

Recent FDA Safety Alerts:
{fda_live}

Provide:
1. Any active FDA alerts relevant to these medications (or "None found")
2. Key drug interactions to monitor (or "None identified")
3. One actionable recommendation for the care team

Be concise and clinical. Flag anything urgent with ⚠️
"""
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400
        )

        alerts.append(response.choices[0].message.content)
        logger.info("Medication agent done — %d alert(s) returned", len(alerts))
        return alerts
