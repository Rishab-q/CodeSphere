FROM python:3.9-slim

WORKDIR /app

# Install only the Python dependencies needed for the worker script
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the worker script into the container
COPY worker.py .

# The command to start the worker process
CMD ["python", "worker.py"]
