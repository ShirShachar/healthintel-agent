"""
FastAPI Backend - Patient Health Intelligence System
"""
import os
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from graph import health_graph
from models.patient import (
    create_patient, get_patient, update_patient, update_patient_vitals,
    list_patients, save_report, get_patient_reports, log_query, update_patient_after_analysis,
    add_note, delete_note
)

app = FastAPI(title="Patient Health Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d3pk95hm8g7yg0.cloudfront.net",
        "https://dl0r41wj7ovw4.cloudfront.net",
        "http://healthintel-frontend-app.s3-website-us-east-1.amazonaws.com",
        "http://localhost:4173",
        "http://localhost:5173",
        "*",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for running the blocking LangGraph pipeline
_executor = ThreadPoolExecutor(max_workers=4)

# In-memory job store: {job_id: {status, result, ...}}
_jobs: dict = {}


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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_pipeline(job_id: str, patient_id: str, initial_state: dict):
    """Runs the LangGraph pipeline in a background thread."""
    logger.info("Job %s started for patient %s", job_id, patient_id)
    try:
        result = health_graph.invoke(initial_state)
        report_id = save_report(patient_id, result)
        log_query(patient_id, "full_analysis", {"report_id": report_id})
        update_patient_after_analysis(patient_id, result)
        logger.info("Job %s complete — report_id=%s", job_id, report_id)
        _jobs[job_id] = {
            "status": "complete",
            "patient_id": patient_id,
            "report_id": report_id,
            "final_report": result.get("final_report"),
            "research_findings": result.get("research_findings", []),
            "medication_alerts": result.get("medication_alerts", []),
            "environment_risks": result.get("environment_risks", []),
            "monitor_summary": result.get("monitor_summary"),
            "errors": result.get("errors", []),
        }
    except Exception as e:
        logger.error("Job %s failed: %s", job_id, str(e))
        _jobs[job_id] = {"status": "error", "error": str(e)}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Patient Health Intelligence System is running"}


@app.get("/patients")
def get_all_patients():
    return {"patients": list_patients()}


@app.post("/patients")
def create_new_patient(patient: PatientCreate):
    patient_id = create_patient(patient.model_dump())
    return {"patient_id": patient_id, "message": "Patient created successfully"}


@app.get("/patients/{patient_id}")
def get_patient_info(patient_id: str):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.put("/patients/{patient_id}")
def edit_patient(patient_id: str, patient: PatientCreate):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    update_patient(patient_id, patient.model_dump())
    return {"message": "Patient updated successfully"}


@app.post("/patients/{patient_id}/vitals")
def add_vitals(patient_id: str, vitals: VitalsUpdate):
    vitals_dict = {k: v for k, v in vitals.model_dump().items() if v is not None}
    update_patient_vitals(patient_id, vitals_dict)
    return {"message": "Vitals updated successfully"}


@app.post("/analyze")
async def run_analysis(request: AnalysisRequest):
    """Starts analysis in a background thread and returns a job ID immediately."""
    import asyncio
    patient = get_patient(request.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    vitals = {}
    if request.vitals:
        vitals = {k: v for k, v in request.vitals.model_dump().items() if v is not None}
    elif patient.get("vitals_history"):
        vitals = patient["vitals_history"][-1]
        vitals.pop("timestamp", None)

    notes = [n["text"] for n in patient.get("notes", [])]

    patient_data = {
        "name": patient["name"],
        "age": patient["age"],
        "gender": patient["gender"],
        "location": patient["location"],
        "conditions": patient["conditions"],
        "medications": patient["medications"],
        "vitals": vitals,
        "notes": notes,
    }

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

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "running", "patient_id": request.patient_id}

    # Run the blocking pipeline in a thread so the event loop stays free
    loop = asyncio.get_running_loop()
    loop.run_in_executor(_executor, _run_pipeline, job_id, request.patient_id, initial_state)

    return {"job_id": job_id, "status": "running"}


@app.get("/analyze/status/{job_id}")
def get_analysis_status(job_id: str):
    """Poll this endpoint to check if an analysis job is complete."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return _jobs[job_id]


class NoteCreate(BaseModel):
    text: str


@app.post("/patients/{patient_id}/notes")
def create_note(patient_id: str, note: NoteCreate):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    note_id = add_note(patient_id, note.text)
    return {"note_id": note_id, "message": "Note added"}


@app.delete("/patients/{patient_id}/notes/{note_id}")
def remove_note(patient_id: str, note_id: str):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    delete_note(patient_id, note_id)
    return {"message": "Note deleted"}


@app.get("/patients/{patient_id}/reports")
def get_reports(patient_id: str, limit: int = 10):
    reports = get_patient_reports(patient_id, limit)
    return {"reports": reports}


@app.get("/health")
def health_check():
    return {"status": "healthy", "agents": ["research", "medication", "environment", "monitor", "coordinator"]}
