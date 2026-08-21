.PHONY: help build run front front-dev back test check clean clean-build check-env hooks

VENV   = venv
PYTHON = $(VENV)/bin/python
PIP    = $(VENV)/bin/pip
FRONT  = frontend

help:
	@echo "Available commands:"
	@echo "  make build       -> install backend + frontend, build the frontend and run"
	@echo "  make run         -> build the frontend and run the server"
	@echo "  make back        -> run the server only (frontend already built)"
	@echo "  make front       -> build the frontend"
	@echo "  make front-dev   -> Vite dev server (HMR, proxy to uvicorn)"
	@echo "  make test        -> run the tests"
	@echo "  make hooks       -> install the git hooks (once per clone)"
	@echo "  make check       -> repository conformance checks"
	@echo "  make clean       -> clean Python artefacts"
	@echo "  make clean-build -> clean everything (venv, node_modules, dist)"

check-env:
	@if [ ! -f .env ]; then \
		echo "⚠️  Fichier .env introuvable — création d'un .env minimal."; \
		echo "GOOGLE_API_KEY=" > .env; \
		echo "MODEL_NAME=gemini-3.1-flash-lite" >> .env; \
	fi
	@if ! grep -qE "(GOOGLE_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY)=." .env backend/.env 2>/dev/null; then \
		echo "⚠️  Aucune clé API (GOOGLE_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY) détectée dans le .env — les fonctionnalités IA peuvent ne pas marcher."; \
	else \
		echo "✅ Clé API détectée"; \
	fi


$(VENV)/bin/activate:
	@echo "🐍 Création du virtual environment..."
	python3 -m venv $(VENV)

$(FRONT)/node_modules:
	@echo "📦 Installation des dépendances frontend..."
	cd $(FRONT) && npm install

build: $(VENV)/bin/activate check-env
	@echo "📦 Installation des dépendances backend..."
	$(PIP) install --upgrade pip -q
	$(PIP) install -r backend/requirements.txt -q
	@echo "✅ Build backend terminé"
	@$(MAKE) run

front: $(FRONT)/node_modules
	@echo "🏗  Build du frontend..."
	cd $(FRONT) && npm run build

front-dev: $(FRONT)/node_modules
	@echo "⚡ Vite dev server (lancez 'make back' à côté)"
	cd $(FRONT) && npm run dev

back: check-env
	@echo "🚀 Lancement du serveur..."
	$(PYTHON) main.py

run: front back

test: $(VENV)/bin/activate check-env
	@echo "📦 Installation des dépendances backend..."
	$(PIP) install --upgrade pip -q
	$(PIP) install -r backend/requirements.txt -q
	@echo "🧪 Lancement des tests..."
	$(PYTHON) -m pytest backend/tests/ -v

hooks:
	@git config core.hooksPath .githooks
	@echo "Hooks installed: $$(ls .githooks | tr '\n' ' ')"
	@echo "Rules: plans/method/02-repository-rules.md"

check:
	@bash scripts/checks.sh staged

clean:
	@echo "🧹 Suppression des fichiers Python compilés..."
	find . -type d -name __pycache__ -not -path "./$(FRONT)/node_modules/*" -exec rm -rf {} +
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete
	find . -name "*.pyd" -delete
	find . -name ".pytest_cache" -exec rm -rf {} +
	find . -name "*.egg-info" -exec rm -rf {} +

clean-build: clean
	@echo "🧹 Suppression des artefacts de build..."
	$(RM) -r $(FRONT)/dist $(FRONT)/node_modules
	find . -name ".DS_Store" -delete
	find . -name "Thumbs.db" -delete
	find . -name "*.log" -delete
	find . -name "*.tmp" -delete
	find . -name "*.bak" -delete
	$(RM) -r $(VENV)
