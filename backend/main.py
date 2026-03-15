"""
FastAPI Backend - Patient Health Intelligence System
"""
import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from graph import health_graph
from models.patient import (
    create_patient, get_patient, update_patient_vitals,
    list_patients, save_report, get_patient_reports, log_query
)

app = FastAPI(title="Patient Health Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    location: str
    conditions: List[str]
    medications: List[str]


class VitalsUpdate(BaseModel):
    heart_rate: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    blood_glucose: Optional[float] = None
    weight_kg: Optional[float] = None


class AnalysisRequest(BaseModel):
    patient_id: str
    vitals: Optional[VitalsUpdate] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "Patient Health Intelligence System is running"}


@app.get("/patients")
def get_all_patients():
    return {"patients": list_patients()}


@app.post("/patients")
def create_new_patient(patient: PatientCreate):
    patient_id = create_patient(patient.dict())
    return {"patient_id": patient_id, "message": "Patient created successfully"}


@app.get("/patients/{patient_id}")
def get_patient_info(patient_id: str):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.post("/patients/{patient_id}/vitals")
def add_vitals(patient_id: str, vitals: VitalsUpdate):
    vitals_dict = {k: v for k, v in vitals.dict().items() if v is not None}
    update_patient_vitals(patient_id, vitals_dict)
    return {"message": "Vitals updated successfully"}


@app.post("/analyze")
async def run_analysis(request: AnalysisRequest):
    """Main endpoint: triggers the full multi-agent pipeline."""
    patient = get_patient(request.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Use latest vitals from history if not provided
    vitals = {}
    if request.vitals:
        vitals = {k: v for k, v in request.vitals.dict().items()
                  if v is not None}
    elif patient.get("vitals_history"):
        vitals = patient["vitals_history"][-1]
        vitals.pop("timestamp", None)

    patient_data = {
        "name": patient["name"],
        "age": patient["age"],
        "gender": patient["gender"],
        "location": patient["location"],
        "conditions": patient["conditions"],
        "medications": patient["medications"],
        "vitals": vitals,
    }

    # Run LangGraph pipeline
    initial_state = {
        "patient_id": request.patient_id,
        "patient_data": patient_data,
        "research_findings": [],
        "medication_alerts": [],
        "environment_risks": [],
        "monitor_summary": None,
        "final_report": None,
        "errors": [],
        "current_step": "starting",
    }

    result = health_graph.invoke(initial_state)

    # Save to MongoDB
    report_id = save_report(request.patient_id, result)
    log_query(request.patient_id, "full_analysis", {"report_id": report_id})

    return {
        "report_id": report_id,
        "patient_id": request.patient_id,
        "final_report": result.get("final_report"),
        "research_findings": result.get("research_findings", []),
        "medication_alerts": result.get("medication_alerts", []),
        "environment_risks": result.get("environment_risks", []),
        "monitor_summary": result.get("monitor_summary"),
        "errors": result.get("errors", []),
    }


@app.get("/patients/{patient_id}/reports")
def get_reports(patient_id: str, limit: int = 10):
    reports = get_patient_reports(patient_id, limit)
    return {"reports": reports}


@app.get("/health")
def health_check():
    return {"status": "healthy", "agents": ["research", "medication", "environment", "monitor", "coordinator"]}
