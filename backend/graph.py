"""
Patient Health Intelligence System - LangGraph Orchestrator
"""
from dotenv import load_dotenv
load_dotenv()
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List, Optional
import operator
from agents.research_agent import ResearchAgent
from agents.medication_agent import MedicationAgent
from agents.environment_agent import EnvironmentAgent
from agents.monitor_agent import MonitorAgent
from agents.coordinator_agent import CoordinatorAgent


# ── Shared State ──────────────────────────────────────────────────────────────
class PatientHealthState(TypedDict):
    # Input
    patient_id: str
    patient_data: dict                        # vitals, conditions, medications, location

    # Agent outputs (accumulated)
    research_findings: Annotated[List[str], operator.add]
    medication_alerts: Annotated[List[str], operator.add]
    environment_risks: Annotated[List[str], operator.add]
    monitor_summary: Optional[str]
    final_report: Optional[str]

    # Control
    errors: Annotated[List[str], operator.add]
    current_step: str


# ── Node Functions ────────────────────────────────────────────────────────────
# Agents are instantiated inside each node function (not at module level)
# so a missing API key never crashes the app on startup.

def run_research(state: PatientHealthState) -> dict:
    """Agent 1: Search latest medical research for patient conditions."""
    try:
        findings = ResearchAgent().run(state["patient_data"])
        return {"research_findings": findings, "current_step": "research_done"}
    except Exception as e:
        return {"errors": [f"Research agent error: {str(e)}"], "current_step": "research_done"}


def run_medication_check(state: PatientHealthState) -> dict:
    """Agent 2: Check real-time drug interactions and FDA alerts."""
    try:
        alerts = MedicationAgent().run(state["patient_data"])
        return {"medication_alerts": alerts, "current_step": "medication_done"}
    except Exception as e:
        return {"errors": [f"Medication agent error: {str(e)}"], "current_step": "medication_done"}


def run_environment_check(state: PatientHealthState) -> dict:
    """Agent 3: Check local air quality, outbreaks, allergens."""
    try:
        risks = EnvironmentAgent().run(state["patient_data"])
        return {"environment_risks": risks, "current_step": "environment_done"}
    except Exception as e:
        return {"errors": [f"Environment agent error: {str(e)}"], "current_step": "environment_done"}


def run_monitor(state: PatientHealthState) -> dict:
    """Agent 4: Analyze vitals trends vs current medical benchmarks."""
    try:
        summary = MonitorAgent().run(
            state["patient_data"], state.get("research_findings", []))
        return {"monitor_summary": summary, "current_step": "monitor_done"}
    except Exception as e:
        return {"errors": [f"Monitor agent error: {str(e)}"], "current_step": "monitor_done"}


def run_coordinator(state: PatientHealthState) -> dict:
    """Agent 5: Synthesize all findings into a final health report."""
    try:
        report = CoordinatorAgent().run(state)
        return {"final_report": report, "current_step": "complete"}
    except Exception as e:
        return {"errors": [f"Coordinator agent error: {str(e)}"], "current_step": "complete"}


# ── Build Graph ───────────────────────────────────────────────────────────────
def build_graph() -> StateGraph:
    graph = StateGraph(PatientHealthState)

    # Add nodes
    graph.add_node("research",    run_research)
    graph.add_node("medication",  run_medication_check)
    graph.add_node("environment", run_environment_check)
    graph.add_node("monitor",     run_monitor)
    graph.add_node("coordinator", run_coordinator)

    # Flow: research + medication + environment run in parallel, then monitor, then coordinator
    graph.set_entry_point("research")
    graph.add_edge("research",    "medication")
    graph.add_edge("medication",  "environment")
    graph.add_edge("environment", "monitor")
    graph.add_edge("monitor",     "coordinator")
    graph.add_edge("coordinator", END)

    return graph.compile()


health_graph = build_graph()
