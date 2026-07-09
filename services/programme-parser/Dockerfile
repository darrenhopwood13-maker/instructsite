FROM python:3.11-slim

# Poppler is required by pdf2image for rasterising Gantt pages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    ghostscript \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
