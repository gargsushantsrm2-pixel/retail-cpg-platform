FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend into /app/backend/ so `import backend.xxx` works
COPY . ./backend/

RUN python -c "import fastapi; import sqlalchemy; print('Dependencies OK')"

EXPOSE 8000

CMD ["python", "backend/init_db.py"]
