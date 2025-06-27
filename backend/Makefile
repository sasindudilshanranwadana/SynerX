.PHONY: dev start test process install clean

# Development server with hot reload
dev:
	uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production server
start:
	uvicorn main:app --host 0.0.0.0 --port 8000

# Run tests
test:
	python -m pytest tests/

# Run video processor
process:
	python core/video_processor.py

# Install dependencies
install:
	pip install -r requirements.txt

# Clean cache files
clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	rm -rf .pytest_cache

# Format code
format:
	black .
	isort .

# Lint code
lint:
	flake8 .
	mypy .

# Full setup
setup: install
	@echo "✅ Setup complete! Run 'make dev' to start development server" 