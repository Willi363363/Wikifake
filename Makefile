.PHONY: clean clean-build build run check-env help test

VENV   = venv
PYTHON = $(VENV)/bin/python
PIP    = $(VENV)/bin/pip

help:
	@echo "Commandes disponibles :"
	@echo "  make build       → créer le venv, installer les dépendances et lancer"
	@echo "  make run         → lancer le projet (venv existant)"
	@echo "  make clean       → tout nettoyer"
	@echo "  make clean-build → supprimer les artefacts de build"
	@echo "  make test        → lancer les tests"

check-env:
	@if [ ! -f .env ]; then \
		echo "❌ Fichier .env introuvable — copie .env.example et remplis ta clé"; \
		exit 1; \
	fi
	@if ! grep -q "OPENAI_API_KEY=." .env; then \
		echo "❌ OPENAI_API_KEY est vide dans le .env — ajoute ta clé avant de lancer"; \
		exit 1; \
	fi
	@echo "✅ Clé API détectée"

build: $(VENV)/bin/activate check-env
	@echo "📦 Installation des dépendances..."
	$(PIP) install --upgrade pip -q
	$(PIP) install -r backend/requirements.txt -q
	@echo "✅ Build terminé"
	@$(MAKE) run

$(VENV)/bin/activate:
	@echo "🐍 Création du virtual environment..."
	python3 -m venv $(VENV)

run: check-env
	@echo "🚀 Lancement de main.py..."
	$(PYTHON) main.py

test: $(VENV)/bin/activate check-env
	@echo "📦 Installation des dépendances..."
	$(PIP) install --upgrade pip -q
	$(PIP) install -r backend/requirements.txt -q
	@echo "🧪 Lancement des tests..."
	$(PYTHON) -m pytest backend/tests/ -v
clean:
	@echo "🧹 Suppression des fichiers Python compilés..."
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete
	find . -name "*.pyd" -delete
	find . -name ".pytest_cache" -exec rm -rf {} +
	find . -name "*.egg-info" -exec rm -rf {} +

clean-build: clean
	@echo "🧹 Suppression des artefacts de build..."
	find . -type d -name dist -not -path "./venv/*" -exec rm -rf {} +
	find . -type d -name build -not -path "./venv/*" -exec rm -rf {} +
	find . -name ".DS_Store" -delete
	find . -name "Thumbs.db" -delete
	find . -name "*.log" -delete
	find . -name "*.tmp" -delete
	find . -name "*.bak" -delete
	$(RM) -r venv