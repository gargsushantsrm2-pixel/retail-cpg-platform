FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy into /app/backend/ so relative imports work (files are a package)
COPY . ./backend/

RUN python -c "import fastapi; import sqlalchemy; print('Dependencies OK')"

EXPOSE 8000

CMD ["python", "/app/backend/init_db.py"]
