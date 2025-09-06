import uuid
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException,WebSocket,WebSocketDisconnect
import json
import redis
from .. import schemas, security
from ..database import get_redis_client

router = APIRouter(tags=["Jobs"])

@router.post("/submit", response_model=schemas.Job)
async def submit_code(submission: schemas.CodeSubmission, current_user: schemas.User = Depends(security.get_current_user), r: redis.Redis = Depends(get_redis_client)):
    if not r: raise HTTPException(status_code=503, detail="Redis service is unavailable.")
    job_id = str(uuid.uuid4())
    user_id = current_user.username
    job = schemas.Job(id=job_id, user_id=user_id, status="queued", code=submission.code, language=submission.language, stdin=submission.stdin)
    r.set(f"job_{job_id}", job.json())
    r.lpush(f"user_jobs_{user_id}", job_id)
    r.lpush("job_queue", job_id)
    return job

@router.get("/submissions", response_model=List[schemas.Job])
async def get_user_submissions(current_user: schemas.User = Depends(security.get_current_user), r: redis.Redis = Depends(get_redis_client)):
    if not r: raise HTTPException(status_code=503, detail="Redis service is unavailable.")
    user_id = current_user.username
    job_ids = r.lrange(f"user_jobs_{user_id}", 0, -1)
    jobs = [schemas.Job.parse_raw(r.get(f"job_{job_id}")) for job_id in job_ids if r.exists(f"job_{job_id}")]
    return jobs


@router.post("/repl/start", status_code=201)
async def start_repl_session(
    language_data: dict,
    current_user: schemas.User = Depends(security.get_current_user),
    r: redis.Redis = Depends(get_redis_client)
):
    session_id = str(uuid.uuid4())
    language = language_data.get("language")

    if language not in ["python", "javascript"]:
        raise HTTPException(status_code=400, detail="Unsupported language for REPL.")

    session_info = {"language": language, "user_id": current_user.username}
    r.set(f"repl_session_{session_id}", json.dumps(session_info), ex=60)

    return {"session_id": session_id}


@router.websocket("/ws/status/{job_id}")
async def job_status_ws(websocket: WebSocket, job_id: str, r: redis.Redis = Depends(get_redis_client)):
    await websocket.accept()

    # 1. Get latest snapshot
    job_json = r.get(f"job_{job_id}")
    if not job_json:
        await websocket.send_json({"error": "Job not found"})
        await websocket.close()
        return

    # Send snapshot first
    job_data = json.loads(job_json)
    await websocket.send_json(job_data)

    # 2. Subscribe to updates
    pubsub = r.pubsub()
    pubsub.subscribe(f"job_updates_{job_id}")

    try:
        loop = asyncio.get_running_loop()
        while True:
            msg = await loop.run_in_executor(None, pubsub.get_message, False, 1.0)
            if msg and msg["type"] == "message":
                update = json.loads(msg["data"])
                await websocket.send_json(update)

                # Optionally close after completion
                if update.get("status") == "completed":
                    await websocket.close()
                    break
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for job {job_id}")
    finally:
        pubsub.close()
