.PHONY: help build run front front-dev back test check clean clean-build check-env hooks

VENV   = venv
PYTHON = $(VENV)/bin/python
PIP    = $(VENV)/bin/pip
FRONT  = frontend

help:
	@echo "Commandes disponibles :"
	@echo "  make build       → installer backend + frontend, builder le front et lancer"
	@echo "  make run         → builder le front et lancer le serveur"
	@echo "  make back        → lancer le serveur seul (front déjà buildé)"
	@echo "  make front       → builder le frontend"
	@echo "  make front-dev   → serveur de dev Vite (HMR, proxy vers uvicorn)"
	@echo "  make test        → lancer les tests"
	@echo "  make hooks       → installer les hooks git (une fois par clone)"
	@echo "  make check       → contrôles de conformité du dépôt"
	@echo "  make clean       → nettoyer les artefacts Python"
	@echo "  make clean-build → tout nettoyer (venv, node_modules, dist)"

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
	@echo "Hooks installés : $$(ls .githooks | tr '\n' ' ')"
	@echo "Règles : plans/methode/02-regles-du-depot.md"

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
