# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`healthintel-agent` is a Python-based health intelligence agent with a separate frontend. It uses Docker Compose for orchestration and `uv` as the preferred Python package manager.

## Package Management

```bash
uv venv                  # create virtual environment
uv pip install -r requirements.txt  # install dependencies
uv run <cmd>             # run commands in the venv
```

## Commands

Update this section as tooling is added (build, lint, test, run commands).

```bash
docker-compose up        # start all services (once docker-compose.yml is populated)
```

## Architecture

```
backend/
  agentd/        # agent daemon — core agent logic lives here
  models/
    patient.py   # patient data model
  scripts/       # utility/automation scripts
frontend/        # UI (framework TBD)
docker-compose.yml
```

- **backend/agentd/** is the primary agent runtime; this is where agent orchestration, tools, and LLM calls will be implemented.
- **backend/models/** holds domain data models starting with `patient.py`.
- The project is containerized via Docker Compose; `docker-compose.yml` is a placeholder pending service definitions.
