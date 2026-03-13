# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`healthintel-agent` is a Python project (inferred from `.gitignore`). The repository is in its initial state with no source code yet.

## Package Management

The `.gitignore` includes entries for `uv`, `pipenv`, `poetry`, and `pdm`. Use `uv` as the preferred package manager unless the project establishes otherwise.

```bash
uv venv          # create virtual environment
uv pip install   # install dependencies
uv run <cmd>     # run commands in the venv
```

## Commands

Update this section as the project grows with build, lint, test, and run commands.
