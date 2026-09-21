# Use official Python image
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr and writing .pyc files
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Install SQLite, curl (for healthcheck), and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-privileged system user and group
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Set working directory and pre-create writable directories with appuser ownership
WORKDIR /app
RUN mkdir -p uploads generated && chown -R appuser:appuser /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code with non-root ownership
COPY --chown=appuser:appuser . .

# Expose port
EXPOSE 8080

# Switch to non-privileged user
USER appuser

# Health check directive
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

# Start the application
CMD ["python", "run.py"]

