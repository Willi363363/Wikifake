# WikiFake — commandes de developpement.
# `make` seul affiche l'aide.

.DEFAULT_GOAL := help
.PHONY: help install install-backend install-frontend build frontend-build \
        run dev serve test test-backend test-frontend lint lint-backend \
        lint-frontend check clean clean-all env

VENV     := venv
PYTHON   := $(VENV)/bin/python
PIP      := $(VENV)/bin/pip
NPM      := npm --prefix frontend

help: ## Affiche cette aide
	@echo "WikiFake — commandes disponibles :"
	@echo
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Demarrage rapide :  make install && make dev"

# ----------------------------------------------------------------- install
$(VENV)/bin/activate:
	@echo "🐍 Creation du virtualenv..."
	@python3 -m venv $(VENV)

install-backend: $(VENV)/bin/activate ## Installe les dependances Python
	@echo "📦 Dependances Python..."
	@$(PIP) install --upgrade pip -q
	@$(PIP) install -r requirements-dev.txt -q

install-frontend: ## Installe les dependances Node
	@echo "📦 Dependances Node..."
	@$(NPM) install --silent

install: install-backend install-frontend env ## Installe tout (backend + frontend + .env)
	@echo "✅ Installation terminee — lancez 'make dev'"

env: ## Cree un .env a partir de .env.example s'il manque
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "📝 .env cree depuis .env.example — renseignez OPENAI_API_KEY"; \
	fi
	@if ! grep -qE '^OPENAI_API_KEY=.+' .env; then \
		echo "⚠️  OPENAI_API_KEY vide : la generation d'articles echouera."; \
	else \
		echo "✅ Cle API detectee"; \
	fi

# ------------------------------------------------------------------- build
frontend-build: ## Construit le frontend dans frontend/dist
	@echo "🏗  Build du frontend..."
	@$(NPM) run build

build: install frontend-build ## Installe tout et construit le frontend
	@echo "✅ Build termine — 'make serve' pour lancer en un seul port"

# --------------------------------------------------------------------- run
dev: env ## Developpement : backend (8000) + Vite avec rechargement a chaud (5173)
	@echo "🚀 Backend sur :8000, interface sur http://localhost:5173"
	@$(PYTHON) main.py & \
	 BACK=$$!; \
	 trap "kill $$BACK 2>/dev/null" EXIT INT TERM; \
	 $(NPM) run dev

serve: env ## Production locale : sert le bundle construit sur :8000
	@if [ ! -f frontend/dist/index.html ]; then $(MAKE) frontend-build; fi
	@echo "🚀 http://localhost:8000"
	@WIKIFAKE_RELOAD=0 $(PYTHON) main.py

run: serve ## Alias de `serve`

# ------------------------------------------------------------------- tests
test-backend: ## Tests Python
	@$(PYTHON) -m pytest

test-frontend: ## Tests JavaScript
	@$(NPM) test

test: test-backend test-frontend ## Toute la suite de tests

lint-backend: ## Analyse statique Python
	@$(PYTHON) -m ruff check backend
	@$(PYTHON) -m ruff format --check backend

lint-frontend: ## Analyse statique JavaScript
	@$(NPM) run lint

lint: lint-backend lint-frontend ## Analyse statique complete

check: lint test ## Ce que la CI verifie

# ------------------------------------------------------------------ nettoyage
clean: ## Supprime les caches et fichiers compiles
	@find . -type d -name __pycache__ -not -path "./venv/*" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -not -path "./venv/*" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .ruff_cache -not -path "./venv/*" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf frontend/dist
	@echo "🧹 Caches supprimes"

clean-all: clean ## Supprime aussi venv/ et node_modules/
	@rm -rf $(VENV) frontend/node_modules
	@echo "🧹 Environnements supprimes"
