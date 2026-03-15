"""
Agent 1 - Research Agent
Searches latest medical research for the patient's conditions.
Uses Tavily: search + extract
"""
import os

from openai import OpenAI
from tavily import TavilyClient


class ResearchAgent:
    """Searches and summarizes the latest medical research for patient conditions."""

    def __init__(self):
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, patient_data: dict) -> list[str]:
        """Run research searches for each patient condition and return findings."""
        conditions = patient_data.get("conditions", [])
        age = patient_data.get("age", "unknown")
        gender = patient_data.get("gender", "unknown")

        if not conditions:
            return ["No conditions listed for this patient."]

        conditions_str = ", ".join(conditions)

        # 1. Search latest research for patient's conditions
        research_results = self.tavily.search(
            query=f"latest treatment guidelines {conditions_str} {age} year old {gender} 2024 2025",
            search_depth="advanced",
            include_domains=["pubmed.ncbi.nlm.nih.gov", "nih.gov",
                             "mayoclinic.org", "nejm.org", "jamanetwork.com"],
            max_results=5
        )

        # 2. Extract detailed info from top result
        snippets = [r["content"]
                    for r in research_results.get("results", [])]
        try:
            top_url = research_results["results"][0]["url"]
            extract_result = self.tavily.extract(urls=[top_url])
            extra = extract_result.get(
                "results", [{}])[0].get("raw_content", "")[:1000]
        except Exception:
            extra = ""

        research_text = "\n".join(snippets)

        prompt = f"""
You are a medical research analyst. Summarize the most relevant and recent findings
for a {age}-year-old {gender} patient with: {conditions_str}.

Research Data:
{research_text}

Additional Detail:
{extra if extra else 'N/A'}

Provide:
1. Most important recent treatment or management update for these conditions
2. Any new clinical guidelines relevant to this patient profile
3. One evidence-based recommendation for the care team

Be concise and cite the source type (e.g., NIH guideline, clinical trial). Flag urgent updates with ⚠️
"""
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400
        )

        return [response.choices[0].message.content]
