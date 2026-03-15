"""
Agent 1 - Research Agent
Searches latest medical research, CDC/WHO updates for patient conditions.
Uses Tavily: search + extract
"""
import os
from tavily import TavilyClient
from openai import OpenAI


class ResearchAgent:
    def __init__(self):
        self.tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        self.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def run(self, patient_data: dict) -> list[str]:
        conditions = patient_data.get("conditions", [])
        findings = []

        for condition in conditions:
            # 1. Search latest research
            search_results = self.tavily.search(
                query=f"latest treatment guidelines {condition} 2024 2025",
                search_depth="advanced",
                include_domains=["pubmed.ncbi.nlm.nih.gov",
                                 "cdc.gov", "who.int", "mayoclinic.org"],
                max_results=3
            )

            # 2. Extract full content from top result
            if search_results["results"]:
                top_url = search_results["results"][0]["url"]
                try:
                    extracted = self.tavily.extract(urls=[top_url])
                    full_content = extracted["results"][0]["raw_content"][:
                                                                          2000] if extracted["results"] else ""
                except Exception:
                    full_content = search_results["results"][0].get(
                        "content", "")

                # 3. LLM summarizes for this patient
                snippets = "\n".join([r["content"]
                                     for r in search_results["results"]])
                prompt = f"""
You are a medical research assistant. Based on the following research snippets about {condition},
provide a concise 3-bullet clinical summary relevant to a patient with this condition.
Focus on: latest treatment updates, warning signs to monitor, lifestyle recommendations.

Research:
{snippets}

Full article excerpt:
{full_content}

Respond with exactly 3 bullet points. Be specific and clinical.
"""
                response = self.llm.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=300
                )
                summary = response.choices[0].message.content
                findings.append(f"**{condition}**: {summary}")

        return findings
