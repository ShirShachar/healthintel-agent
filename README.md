# HealthIntel Agent

A multi-agent clinical intelligence system that generates real-time health briefs for patients. Five AI agents pull the latest medical research, check FDA drug alerts, assess local environmental risks, analyze vitals against clinical benchmarks, and synthesize everything into a structured care-team report — all triggered by a single button click.

**Live demo:** https://d3pk95hm8g7yg0.cloudfront.net

---

## How It Works

When you click **Run Analysis** on a patient, the system:

1. **Research Agent** — searches PubMed, CDC, and WHO for the latest treatment guidelines for the patient's conditions
2. **Medication Agent** — checks FDA MedWatch for active drug alerts and drug-drug interactions
3. **Environment Agent** — pulls local air quality, disease outbreak alerts, and allergen levels for the patient's location
4. **Monitor Agent** — compares the patient's vitals against age/condition-specific clinical benchmarks
5. **Coordinator Agent** — synthesizes all findings into a structured clinical brief with status, key findings, action steps, and follow-up recommendations

The analysis runs asynchronously in a background thread. The frontend polls for the result every 3 seconds and updates in real time.

---

## Folder Structure

```
healthintel-agent/
├── backend/
│   ├── main.py                    # FastAPI app — all REST endpoints
│   ├── graph.py                   # LangGraph orchestrator (5-agent pipeline)
│   ├── requirements.txt           # Pinned Python dependencies
│   ├── Procfile                   # Gunicorn startup command for EB
│   ├── Dockerfile                 # Docker build for local/container use
│   ├── agents/
│   │   ├── research_agent.py      # PubMed / CDC / WHO research
│   │   ├── medication_agent.py    # FDA alerts + drug interactions
│   │   ├── environment_agent.py   # Air quality, outbreaks, allergens
│   │   ├── monitor_agent.py       # Vitals analysis vs clinical benchmarks
│   │   └── coordinator_agent.py   # Final report synthesis
│   ├── models/
│   │   └── patient.py             # MongoDB models: patients, reports, notes, vitals
│   ├── scripts/
│   │   └── test_agents.py         # Pytest integration tests (mocked)
│   ├── .ebextensions/
│   │   └── alb-timeout.config     # ALB idle timeout (300s) for long analyses
│   └── .platform/
│       └── nginx/conf.d/
│           └── timeout.conf       # nginx proxy timeout (300s)
├── frontend/
│   ├── src/
│   │   └── App.jsx                # Full React UI (single-file)
│   ├── .env.production            # VITE_API_URL for production build
│   └── vite.config.js
├── docker-compose.yml             # Local full-stack orchestration
└── README.md
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB Atlas account (free tier works)
- OpenAI API key
- Tavily API key

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Create `backend/.env`:
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
MONGODB_DB=patient_health_intelligence
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Create `frontend/.env.local` to point at the local backend:
```
VITE_API_URL=http://localhost:8000
```

### Docker (full stack)

```bash
docker-compose up --build
# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
```

---

## Usage Example

### 1. Create a patient

```bash
curl -X POST http://localhost:8000/patients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "age": 52,
    "gender": "Female",
    "location": "Boston, MA",
    "conditions": ["Type 2 Diabetes", "Hypertension"],
    "medications": ["Metformin", "Lisinopril"]
  }'
# → {"patient_id": "abc123...", "message": "Patient created successfully"}
```

### 2. Log vitals

```bash
curl -X POST http://localhost:8000/patients/abc123/vitals \
  -H "Content-Type: application/json" \
  -d '{
    "heart_rate": 72,
    "blood_pressure_systolic": 138,
    "blood_pressure_diastolic": 88,
    "blood_glucose": 187.0,
    "oxygen_saturation": 97.0
  }'
```

### 3. Run analysis

```bash
# Start the analysis — returns immediately
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "abc123"}'
# → {"job_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "status": "running"}

# Poll for result
curl http://localhost:8000/analyze/status/<job_id>
# → {"status": "complete", "final_report": "...", "research_findings": [...], ...}
```

### 4. Add a clinical note

```bash
curl -X POST http://localhost:8000/patients/abc123/notes \
  -H "Content-Type: application/json" \
  -d '{"text": "Patient reported fatigue after evening walks."}'
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients` | List all patients |
| POST | `/patients` | Create a patient |
| GET | `/patients/{id}` | Get patient detail |
| PUT | `/patients/{id}` | Update patient |
| POST | `/patients/{id}/vitals` | Log vitals |
| POST | `/patients/{id}/notes` | Add clinical note |
| DELETE | `/patients/{id}/notes/{note_id}` | Delete note |
| GET | `/patients/{id}/reports` | Get analysis history |
| POST | `/analyze` | Start analysis — returns `job_id` |
| GET | `/analyze/status/{job_id}` | Poll for analysis result |
| GET | `/health` | Health check |

---

## Running Tests

```bash
pytest backend/scripts/test_agents.py -v
```

Tests use mocked MongoDB and mocked LangGraph/Tavily/OpenAI — no real API keys needed. Covers patient CRUD, vitals, notes, analysis pipeline, error handling, and query logging.

---

## Deployment

### Backend — AWS Elastic Beanstalk

```bash
cd backend
eb init        # first time: select us-east-1, Python 3.11 platform
eb deploy
```

Set environment variables in EB console under **Configuration → Software → Environment properties**:
```
OPENAI_API_KEY
TAVILY_API_KEY
MONGODB_URI
MONGODB_DB
```

The `.ebextensions/alb-timeout.config` automatically sets the ALB idle timeout to 300 seconds (required for long-running analyses).

### Frontend — AWS S3 + CloudFront

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://<your-bucket> --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

Set `VITE_API_URL` in `frontend/.env.production` to your backend CloudFront URL before building.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, plain CSS |
| Backend | FastAPI, Python 3.11 |
| Agent Orchestration | LangGraph |
| LLM | OpenAI gpt-4o-mini |
| Search | Tavily (search, extract, crawl) |
| Database | MongoDB Atlas |
| Backend Hosting | AWS Elastic Beanstalk |
| Frontend Hosting | AWS S3 + CloudFront |
