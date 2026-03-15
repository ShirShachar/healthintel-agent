"""
MongoDB Models - Patient Health Intelligence System
"""
import os
from datetime import datetime

from pymongo import MongoClient


def get_db():
    """Return the MongoDB database instance."""
    client = MongoClient(os.getenv("MONGODB_URI"))
    return client[os.getenv("MONGODB_DB", "patient_health_intelligence")]


# ── Patient Model ─────────────────────────────────────────────────────────────
def create_patient(patient_data: dict) -> str:
    """Insert a new patient document and return its inserted ID."""
    db = get_db()
    patient = {
        "name": patient_data["name"],
        "age": patient_data.get("age"),
        "gender": patient_data.get("gender"),
        "location": patient_data.get("location"),
        "conditions": patient_data.get("conditions", []),
        "medications": patient_data.get("medications", []),
        "vitals_history": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = db.patients.insert_one(patient)
    return str(result.inserted_id)


def get_patient(patient_id: str) -> dict:
    """Fetch a single patient by ID, returning None if not found."""
    from bson import ObjectId
    db = get_db()
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if patient:
        patient["_id"] = str(patient["_id"])
    return patient


def update_patient_vitals(patient_id: str, vitals: dict):
    """Append a vitals entry to the patient's vitals_history."""
    from bson import ObjectId
    db = get_db()
    vitals_entry = {"timestamp": datetime.utcnow(), **vitals}
    db.patients.update_one(
        {"_id": ObjectId(patient_id)},
        {
            "$push": {"vitals_history": vitals_entry},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )


def list_patients() -> list:
    """Return a summary list of all patients."""
    db = get_db()
    patients = list(db.patients.find(
        {}, {"name": 1, "age": 1, "conditions": 1, "updated_at": 1}))
    for p in patients:
        p["_id"] = str(p["_id"])
    return patients


# ── Report Model ──────────────────────────────────────────────────────────────
def save_report(patient_id: str, report_data: dict) -> str:
    """Persist a generated health report and return its inserted ID."""
    db = get_db()
    report = {
        "patient_id": patient_id,
        "final_report": report_data.get("final_report"),
        "research_findings": report_data.get("research_findings", []),
        "medication_alerts": report_data.get("medication_alerts", []),
        "environment_risks": report_data.get("environment_risks", []),
        "monitor_summary": report_data.get("monitor_summary"),
        "errors": report_data.get("errors", []),
        "generated_at": datetime.utcnow(),
    }
    result = db.reports.insert_one(report)
    return str(result.inserted_id)


def get_patient_reports(patient_id: str, limit: int = 10) -> list:
    """Return the most recent reports for a patient, newest first."""
    db = get_db()
    reports = list(
        db.reports.find(
            {"patient_id": patient_id},
            {"final_report": 1, "generated_at": 1, "errors": 1}
        ).sort("generated_at", -1).limit(limit)
    )
    for r in reports:
        r["_id"] = str(r["_id"])
    return reports


# ── Query Log Model ───────────────────────────────────────────────────────────
def log_query(patient_id: str, query_type: str, metadata: dict = None):
    """Record a query event for a patient in the query_logs collection."""
    db = get_db()
    db.query_logs.insert_one({
        "patient_id": patient_id,
        "query_type": query_type,
        "metadata": metadata or {},
        "timestamp": datetime.utcnow(),
    })
