"""
Agent 3 - Environment Agent
Checks local air quality, disease outbreaks, allergen levels, weather risks.
Uses Tavily: search + map
"""
import os

from openai import OpenAI
from tavily import TavilyClient


class EnvironmentAgent:
    def __init__(self):
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, patient_data: dict) -> list[str]:
        location = patient_data.get("location", "United States")
        conditions = patient_data.get("conditions", [])
        risks = []

        # 1. Search local air quality
        air_results = self.tavily.search(
            query=f"air quality index {location} today",
            search_depth="basic",
            max_results=2
        )

        # 2. Search disease outbreaks in area
        outbreak_results = self.tavily.search(
            query=f"disease outbreak health alert {location} 2025",
            search_depth="advanced",
            include_domains=["cdc.gov", "who.int", "health.gov"],
            max_results=3
        )

        # 3. Search allergen levels if patient has respiratory conditions
        allergen_snippets = ""
        respiratory = ["asthma", "copd", "allergies", "rhinitis"]
        if any(c.lower() in respiratory for c in conditions):
            allergen_results = self.tavily.search(
                query=f"pollen count allergen levels {location} today",
                search_depth="basic",
                max_results=2
            )
            allergen_snippets = "\n".join(
                [r["content"] for r in allergen_results.get("results", [])])

        # 4. Map health resources in area
        try:
            map_results = self.tavily.map(
                url=f"https://www.cdc.gov/",
                max_depth=1
            )
            cdc_pages = str(map_results)[:500]
        except Exception:
            cdc_pages = ""

        air_snippets = "\n".join([r["content"]
                                 for r in air_results.get("results", [])])
        outbreak_snippets = "\n".join(
            [r["content"] for r in outbreak_results.get("results", [])])

        prompt = f"""
You are an environmental health analyst. Assess environmental health risks for a patient in {location}
with the following conditions: {', '.join(conditions) if conditions else 'general health monitoring'}.

Air Quality Data:
{air_snippets}

Local Disease Outbreaks / Health Alerts:
{outbreak_snippets}

Allergen / Pollen Data:
{allergen_snippets if allergen_snippets else 'N/A'}

Provide:
1. Current air quality risk level (Low/Medium/High) and brief explanation
2. Any active local health alerts relevant to this patient's conditions
3. One specific environmental precaution for this patient today

Use ⚠️ for urgent items and ✅ for clear/safe status.
"""
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=350
        )

        risks.append(response.choices[0].message.content)
        return risks
