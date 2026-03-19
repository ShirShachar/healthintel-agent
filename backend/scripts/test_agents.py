"""
Integration tests for Patient Health Intelligence API
MongoDB and LangGraph/OpenAI/Tavily are fully mocked — no real API keys needed.

Run:
    pytest backend/scripts/test_agents.py -v
"""
import sys
import os

# Put backend root on path so imports resolve from any working directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import MagicMock, patch
from bson import ObjectId
from fastapi.testclient import TestClient

# ── Shared test data ───────────────────────────────────────────────────────────

PATIENT_ID = "507f1f77bcf86cd799439011"
REPORT_ID  = "507f1f77bcf86cd799439012"
NOTE_ID    = "507f1f77bcf86cd799439013"

CREATE_PAYLOAD = {
    "name": "Jane Doe",
    "age": 52,
    "gender": "Female",
    "location": "Boston, MA",
    "conditions": ["Type 2 Diabetes", "Hypertension"],
    "medications": ["Metformin", "Lisinopril"],
}

VITALS_PAYLOAD = {
    "heart_rate": 72,
    "blood_pressure_systolic": 118,
    "blood_pressure_diastolic": 76,
    "temperature": 98.6,
    "oxygen_saturation": 98.0,
    "blood_glucose": 118.0,
}

MOCK_ANALYSIS = {
    "final_report": (
        "### ⚡ STATUS\nStable — glucose within ADA target range\n"
        "### 📋 KEY FINDINGS\n• Blood glucose at 118 mg/dL within target\n"
        "• Blood pressure 118/76 within normal limits\n"
        "• No active FDA alerts for Metformin or Lisinopril\n"
        "### 💊 MEDICATIONS\n**Metformin** — Role: Controls glucose for Type 2 Diabetes. "
        "Status: No current alerts. Watch: HbA1c <7%.\n"
        "**Lisinopril** — Role: Manages Hypertension. Status: No current alerts. Watch: BP <130/80.\n"
        "### 🔬 CONDITIONS\n**Type 2 Diabetes** Controlled — Glucose 118 mg/dL. "
        "Research update: ADA 2025 recommends HbA1c <7%.\n"
        "**Hypertension** Controlled — BP 118/76 mmHg. Research update: ACC 2025 target <130/80.\n"
        "### 📊 VITALS\nBlood Glucose: 118 mg/dL → 70–140 mg/dL → ✅ Normal\n"
        "Blood Pressure: 118/76 mmHg → 90–120/60–80 mmHg → ✅ Normal\n"
        "### 🌍 ENVIRONMENT — Boston, MA\nRisk level: Low — AQI Good (38).\n"
        "Precaution: Stay hydrated during outdoor activity for Hypertension.\n"
        "### ✅ NEXT STEPS\n1. For Type 2 Diabetes → HbA1c check in 3 months, target <7%\n"
        "2. For Hypertension → BP recheck in 4 weeks, target <130/80\n"
        "### 📅 FOLLOW-UP\n3 months to HbA1c and renal function panel"
    ),
    "research_findings": [
        "**Type 2 Diabetes**: ADA 2025 guidelines recommend HbA1c target <7% for most adults"
    ],
    "medication_alerts": [
        "Metformin: No active FDA alerts. Monitor renal function (eGFR) annually."
    ],
    "environment_risks": [
        "Boston, MA: AQI Good (38). Low risk for respiratory conditions today."
    ],
    "monitor_summary": "Stable. Glucose 118 mg/dL on target. BP 118/76 within range.",
    "errors": [],
}


def _make_patient(notes=None, vitals_history=None):
    """Return a serialised patient dict (as get_patient() would return it)."""
    return {
        "_id": PATIENT_ID,
        "name": "Jane Doe",
        "age": 52,
        "gender": "Female",
        "location": "Boston, MA",
        "conditions": ["Type 2 Diabetes", "Hypertension"],
        "medications": ["Metformin", "Lisinopril"],
        "vitals_history": vitals_history or [],
        "notes": notes or [],
        "created_at": "2026-03-18T12:00:00Z",
        "updated_at": "2026-03-18T12:00:00Z",
    }


def _make_db(patient=None):
    """Return a MagicMock that behaves like a pymongo database."""
    db = MagicMock()
    p = patient or _make_patient()

    # patients collection
    ins_p = MagicMock()
    ins_p.inserted_id = ObjectId(PATIENT_ID)
    db.patients.insert_one.return_value = ins_p
    db.patients.find_one.return_value = p
    db.patients.find.return_value = [p]
    db.patients.update_one.return_value = MagicMock()

    # reports collection — find().sort().limit() chain
    ins_r = MagicMock()
    ins_r.inserted_id = ObjectId(REPORT_ID)
    db.reports.insert_one.return_value = ins_r
    cursor = MagicMock()
    cursor.sort.return_value = cursor
    cursor.limit.return_value = []
    db.reports.find.return_value = cursor

    # query_logs collection
    db.query_logs.insert_one.return_value = MagicMock()

    return db


# ── Fixture ────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def patched_client(request):
    """
    Patches get_db and health_graph.invoke for every test.
    Injects `client` and `mock_db` onto the test instance when used in a class.
    """
    db = _make_db()
    with patch("models.patient.get_db", return_value=db), \
         patch("graph.health_graph.invoke", return_value=MOCK_ANALYSIS):
        from main import app
        client = TestClient(app)
        if request.instance is not None:
            request.instance.client = client
            request.instance.db = db
        yield client, db


# ── Test 1: Create patient ─────────────────────────────────────────────────────

def test_create_patient(patched_client):
    client, db = patched_client
    res = client.post("/patients", json=CREATE_PAYLOAD)
    assert res.status_code == 200
    data = res.json()
    assert "patient_id" in data
    assert data["patient_id"] == PATIENT_ID
    assert data["message"] == "Patient created successfully"
    db.patients.insert_one.assert_called_once()


# ── Test 2: List patients ──────────────────────────────────────────────────────

def test_list_patients(patched_client):
    client, db = patched_client
    res = client.get("/patients")
    assert res.status_code == 200
    data = res.json()
    assert "patients" in data
    assert len(data["patients"]) == 1
    assert data["patients"][0]["name"] == "Jane Doe"
    assert data["patients"][0]["conditions"] == ["Type 2 Diabetes", "Hypertension"]


# ── Test 3: Add vitals ─────────────────────────────────────────────────────────

def test_add_vitals(patched_client):
    client, db = patched_client
    res = client.post(f"/patients/{PATIENT_ID}/vitals", json=VITALS_PAYLOAD)
    assert res.status_code == 200
    assert res.json()["message"] == "Vitals updated successfully"
    # Confirm update_one was called (vitals pushed to vitals_history)
    db.patients.update_one.assert_called()
    call_args = db.patients.update_one.call_args
    assert "$push" in call_args[0][1]
    assert "vitals_history" in call_args[0][1]["$push"]


# ── Test 4: Analyze returns all 5 agent sections ──────────────────────────────

def test_analyze_returns_all_sections(patched_client):
    client, _ = patched_client
    res = client.post("/analyze", json={"patient_id": PATIENT_ID})
    assert res.status_code == 200
    data = res.json()
    assert data["final_report"] is not None
    # All 5 coordinator sections present in the report
    for section in ["STATUS", "KEY FINDINGS", "MEDICATIONS", "CONDITIONS", "VITALS",
                    "ENVIRONMENT", "NEXT STEPS", "FOLLOW-UP"]:
        assert section in data["final_report"], f"Missing section: {section}"
    assert len(data["research_findings"]) > 0
    assert len(data["medication_alerts"]) > 0
    assert len(data["environment_risks"]) > 0
    assert data["monitor_summary"] is not None
    assert data["errors"] == []


# ── Test 5: 404 for unknown patient ───────────────────────────────────────────

def test_analyze_404_unknown_patient(patched_client):
    client, db = patched_client
    db.patients.find_one.return_value = None
    res = client.post("/analyze", json={"patient_id": "000000000000000000000000"})
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_get_patient_404(patched_client):
    client, db = patched_client
    db.patients.find_one.return_value = None
    res = client.get("/patients/000000000000000000000000")
    assert res.status_code == 404


# ── Test 6: Query log entry after analysis ────────────────────────────────────

def test_analyze_logs_query(patched_client):
    client, db = patched_client
    client.post("/analyze", json={"patient_id": PATIENT_ID})
    db.query_logs.insert_one.assert_called_once()
    logged = db.query_logs.insert_one.call_args[0][0]
    assert logged["patient_id"] == PATIENT_ID
    assert logged["query_type"] == "full_analysis"
    assert "report_id" in logged.get("metadata", {})


# ── Test 7: Create note ───────────────────────────────────────────────────────

def test_create_note(patched_client):
    client, db = patched_client
    res = client.post(
        f"/patients/{PATIENT_ID}/notes",
        json={"text": "Patient reported fatigue after evening walks."},
    )
    assert res.status_code == 200
    data = res.json()
    assert "note_id" in data
    assert data["message"] == "Note added"
    db.patients.update_one.assert_called()
    call_args = db.patients.update_one.call_args
    assert "$push" in call_args[0][1]
    assert "notes" in call_args[0][1]["$push"]


# ── Test 8: Delete note ───────────────────────────────────────────────────────

def test_delete_note(patched_client):
    client, db = patched_client
    res = client.delete(f"/patients/{PATIENT_ID}/notes/{NOTE_ID}")
    assert res.status_code == 200
    assert res.json()["message"] == "Note deleted"
    db.patients.update_one.assert_called()
    call_args = db.patients.update_one.call_args
    assert "$pull" in call_args[0][1]
    assert "notes" in call_args[0][1]["$pull"]
