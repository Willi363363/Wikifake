.PHONY: clean clean-pyc clean-build build run help

VENV   = venv
PYTHON = $(VENV)/bin/python
PIP    = $(VENV)/bin/pip

help:
	@echo "Commandes disponibles :"
	@echo "  make build       → créer le venv, installer les dépendances et lancer"
	@echo "  make run         → lancer le projet (venv existant)"
	@echo "  make clean       → tout nettoyer"
	@echo "  make clean-pyc   → supprimer les fichiers Python compilés"
	@echo "  make clean-build → supprimer les artefacts de build"

build: $(VENV)/bin/activate
	@echo "📦 Installation des dépendances..."
	$(PIP) install --upgrade pip -q
	$(PIP) install -r requirements.txt -q
	@echo "✅ Build terminé"
	@$(MAKE) run

$(VENV)/bin/activate:
	@echo "🐍 Création du virtual environment..."
	python3 -m venv $(VENV)

run:
	@echo "🚀 Lancement de main.py..."
	$(PYTHON) main.py

clean: clean-pyc clean-build
	@echo "✅ Projet nettoyé"

clean-pyc:
	@echo "🧹 Suppression des fichiers Python compilés..."
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete
	find . -name "*.pyd" -delete
	find . -name ".pytest_cache" -exec rm -rf {} +
	find . -name "*.egg-info" -exec rm -rf {} +

clean-build:
	@echo "🧹 Suppression des artefacts de build..."
	find . -type d -name dist -not -path "./venv/*" -exec rm -rf {} +
	find . -type d -name build -not -path "./venv/*" -exec rm -rf {} +
	find . -name ".DS_Store" -delete
	find . -name "Thumbs.db" -delete
	find . -name "*.log" -delete
	find . -name "*.tmp" -delete