"""
MongoDB Models - Patient Health Intelligence System
"""
from pymongo import MongoClient
from datetime import datetime
import os


def get_db():
    client = MongoClient(os.getenv("MONGODB_URI"))
    return client[os.getenv("MONGODB_DB", "patient_health_intelligence")]


# ── Patient Model ─────────────────────────────────────────────────────────────
def create_patient(patient_data: dict) -> str:
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
    from bson import ObjectId
    db = get_db()
    patient = db.patients.find_one({"_id": ObjectId(patient_id)})
    if patient:
        patient["_id"] = str(patient["_id"])
        for note in patient.get("notes", []):
            if "_id" in note:
                note["_id"] = str(note["_id"])
            if "created_at" in note and hasattr(note["created_at"], "isoformat"):
                note["created_at"] = note["created_at"].isoformat() + "Z"
        for v in patient.get("vitals_history", []):
            if "timestamp" in v and hasattr(v["timestamp"], "isoformat"):
                v["timestamp"] = v["timestamp"].isoformat() + "Z"
        for field in ("created_at", "updated_at", "last_analyzed"):
            if field in patient and hasattr(patient[field], "isoformat"):
                patient[field] = patient[field].isoformat() + "Z"
        if "last_report" in patient and isinstance(patient["last_report"], dict):
            lr = patient["last_report"]
            if "generated_at" in lr and hasattr(lr["generated_at"], "isoformat"):
                lr["generated_at"] = lr["generated_at"].isoformat() + "Z"
    return patient


def update_patient(patient_id: str, patient_data: dict):
    from bson import ObjectId
    db = get_db()
    fields = {k: v for k, v in patient_data.items() if k in
              ("name", "age", "gender", "location", "conditions", "medications")}
    fields["updated_at"] = datetime.utcnow()
    db.patients.update_one({"_id": ObjectId(patient_id)}, {"$set": fields})


def update_patient_vitals(patient_id: str, vitals: dict):
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
    db = get_db()
    patients = list(db.patients.find({}, {"name": 1, "age": 1, "gender": 1, "location": 1,
                    "conditions": 1, "medications": 1, "last_analyzed": 1, "updated_at": 1}))
    for p in patients:
        p["_id"] = str(p["_id"])
    return patients


# ── Report Model ──────────────────────────────────────────────────────────────
def save_report(patient_id: str, report_data: dict) -> str:
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


# ── Notes Model ───────────────────────────────────────────────────────────────
def add_note(patient_id: str, text: str) -> str:
    from bson import ObjectId
    db = get_db()
    note = {"_id": ObjectId(), "text": text, "created_at": datetime.utcnow()}
    db.patients.update_one(
        {"_id": ObjectId(patient_id)},
        {"$push": {"notes": note}, "$set": {"updated_at": datetime.utcnow()}}
    )
    return str(note["_id"])


def delete_note(patient_id: str, note_id: str):
    from bson import ObjectId
    db = get_db()
    db.patients.update_one(
        {"_id": ObjectId(patient_id)},
        {"$pull": {"notes": {"_id": ObjectId(note_id)}}}
    )


# ── Query Log Model ───────────────────────────────────────────────────────────
def log_query(patient_id: str, query_type: str, metadata: dict = None):
    db = get_db()
    db.query_logs.insert_one({
        "patient_id": patient_id,
        "query_type": query_type,
        "metadata": metadata or {},
        "timestamp": datetime.utcnow(),
    })


def update_patient_after_analysis(patient_id: str, result: dict):
    """Update patient profile with latest analysis findings and timestamp."""
    from bson import ObjectId
    db = get_db()
    db.patients.update_one(
        {"_id": ObjectId(patient_id)},
        {"$set": {
            "last_analyzed": datetime.utcnow(),
            "last_report": {
                "final_report": result.get("final_report"),
                "research_findings": result.get("research_findings", []),
                "medication_alerts": result.get("medication_alerts", []),
                "environment_risks": result.get("environment_risks", []),
                "monitor_summary": result.get("monitor_summary"),
                "errors": result.get("errors", []),
                "generated_at": datetime.utcnow(),
            },
            "updated_at": datetime.utcnow(),
        }}
    )
