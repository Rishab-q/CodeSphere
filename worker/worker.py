import redis
from docker import APIClient,DockerClient
import time
import json
import os
import shutil
import threading
import asyncio
import stat
from aiohttp import web

# --- CONFIGURATION ---
EXECUTION_IMAGE = "code-executor-sandbox"
TEMP_DIR_IN_WORKER = "/app/temp_jobs"
HOST_PROJECT_DIR = os.getenv("HOST_PROJECT_DIR")
EXECUTION_TIMEOUT = 10

# --- REDIS & DOCKER CLIENTS ---
r = redis.Redis(host="redis", port=6379, db=0, decode_responses=True)

client = DockerClient(base_url="unix:///var/run/docker.sock")
api_client = APIClient(base_url="unix:///var/run/docker.sock")

print("Docker clients initialized.")

# --- BATCH JOB EXECUTION LOGIC ---
def get_job_config(language):
    configs = {
        "python": {"filename": "main.py", "compile_cmd": None, "execute_base": "python3 main.py"},
        "cpp": {"filename": "main.cpp", "compile_cmd": "g++ main.cpp -o main", "execute_base": "./main"},
        "c": {"filename": "main.c", "compile_cmd": "gcc main.c -o main", "execute_base": "./main"},
        "java": {"filename": "Main.java", "compile_cmd": "javac Main.java", "execute_base": "java Main"},
        "javascript": {"filename": "main.js", "compile_cmd": None, "execute_base": "node main.js"}
    }
    return configs.get(language)

def execute_code_in_container(job_id, code, language, stdin):
    if not client: return "Docker client not available."
    if not HOST_PROJECT_DIR: return "An unexpected error occurred: HOST_PROJECT_DIR environment variable is not set."
    config = get_job_config(language)
    if not config: return "Unsupported language."
    job_dir_in_worker = os.path.join(TEMP_DIR_IN_WORKER, job_id)
    os.makedirs(job_dir_in_worker, exist_ok=True)
    try:
        source_file_path = os.path.join(job_dir_in_worker, config["filename"])
        with open(source_file_path, "w") as f: f.write(code)
        host_job_dir = os.path.join(HOST_PROJECT_DIR, "temp_jobs", job_id)
        working_dir_in_container = "/sandbox"
        execute_cmd = f"timeout {EXECUTION_TIMEOUT} {config['execute_base']}"
        if stdin:
            input_file_path = os.path.join(job_dir_in_worker, "input.txt")
            with open(input_file_path, "w") as f: f.write(stdin)
            execute_cmd += " < input.txt"
            os.chmod(input_file_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
        os.chmod(job_dir_in_worker, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
        os.chmod(source_file_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
        if config["compile_cmd"]:
            try:
                client.containers.run(
                    image=EXECUTION_IMAGE, command=f'/bin/sh -c "{config["compile_cmd"]}"',
                    volumes={host_job_dir: {'bind': working_dir_in_container, 'mode': 'rw'}},
                    working_dir=working_dir_in_container, user="appuser", remove=True, stderr=True
                )
            except docker.errors.ContainerError as e:
                return f"Compilation Error:\n{e.stderr.decode('utf-8', 'ignore')}"
        try:
            output = client.containers.run(
                image=EXECUTION_IMAGE, command=f'/bin/sh -c "{execute_cmd}"',
                volumes={host_job_dir: {'bind': working_dir_in_container, 'mode': 'rw'}},
                working_dir=working_dir_in_container, user="appuser", remove=True, stderr=True
            )
            return output.decode('utf-8', 'ignore')
        except docker.errors.ContainerError as e:
            if e.exit_status == 124: return f"Execution Error: Timeout ({EXECUTION_TIMEOUT}s limit exceeded)."
            return f"Execution Error:\n{e.stderr.decode('utf-8', 'ignore')}"
    except Exception as e:
        return f"An unexpected error occurred: {str(e)}"
    finally:
        if os.path.exists(job_dir_in_worker): shutil.rmtree(job_dir_in_worker)

# --- INTERACTIVE REPL LOGIC (REVISED) ---
async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    session_id = request.match_info.get('session_id')
    session_info_json = r.get(f"repl_session_{session_id}")
    
    if not session_info_json:
        await ws.send_str("Error: Invalid or expired session ID.")
        await ws.close()
        return ws
        
    session_info = json.loads(session_info_json)
    language = session_info.get("language")
    
    # Set appropriate command for each language
    if language == "python":
        command = ["python3", "-i", "-q"]
        env = {}  # Interactive, quiet mode
    elif language == "javascript":
        command = ["node", "-i", "--no-warnings"]
        env = {"NODE_NO_READLINE": "1"}  # Interactive node
    else:
        await ws.send_str(f"Error: Language {language} not supported for REPL")
        await ws.close()
        return ws

    container = None
    try:
        # Start container with proper interactive settings
        container = client.containers.run(
            image=EXECUTION_IMAGE,
            command=command,
            stdin_open=True,
            tty=True,
            detach=True,
            network_disabled=True,
            user="appuser",
            mem_limit="128m",  # Reduced memory limit
            cpu_quota=25000,   # Reduced CPU quota
            remove=True,       # Auto-remove when stopped
            environment=env
        )
        
        # Create streams for stdin/stdout
        exec_id = api_client.exec_create(
                    container.id,
                    cmd=command,  # e.g. "python3" or "node"
                    tty=True,
                    stdin=True,
                    stdout=True,
                    stderr=True
                    )["Id"]

# Step 2: Attach to exec session socket
        stream = api_client.exec_start(
            exec_id,
            tty=True,
            socket=True,
            stream=True
        )

        # Important: stream is a low-level socket wrapper
        sock = stream._sock
        sock.setblocking(False)

        # Step 3: Start background tasks for I/O bridging
        output_task = asyncio.create_task(forward_stream_to_websocket(sock, ws))
        input_task = asyncio.create_task(forward_websocket_to_stream(ws, sock))
        
        # Wait for either task to complete (connection closed)
        done, pending = await asyncio.wait(
            [input_task, output_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel remaining tasks
        for task in pending:
            task.cancel()
            
    except Exception as e:
        print(f"Error in REPL session {session_id}: {e}")
        await ws.send_str(f"Error: {str(e)}")
    finally:
        # Cleanup
        if container:
            try:
                container.stop(timeout=1)
            except docker.errors.NotFound:
                pass
            except Exception as e:
                print(f"Error stopping container: {e}")
        
        await ws.close()
        print(f"REPL session {session_id} terminated.")
    
    return ws

async def forward_stream_to_websocket(sock, websocket):
    """Forward container output to websocket"""
    loop=asyncio.get_running_loop()
    try:
        while not websocket.closed:
            data = await loop.sock_recv(sock, 1024)
            if not data:
                break
            await websocket.send_str(data.decode('utf-8', 'ignore'))
    except Exception as e:
        print(f"Output forwarding error: {e}")

async def forward_websocket_to_stream(websocket, sock):
    """Forward websocket input to container"""
    loop = asyncio.get_running_loop()
    try:
        async for msg in websocket:
            if msg.type == web.WSMsgType.TEXT:
                # Ensure proper line ending for REPL
                data = msg.data

                await loop.sock_sendall(sock, data.encode('utf-8'))
            elif msg.type in (web.WSMsgType.CLOSE, web.WSMsgType.ERROR):
                break
    except Exception as e:
        print(f"Input forwarding error: {e}")
        
def start_websocket_server():
    app = web.Application()
    app.router.add_get('/ws/interactive/{session_id}', websocket_handler)
    runner = web.AppRunner(app)
    async def run_server():
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', 8001)
        await site.start()
        print("WebSocket server started on port 8001")
        while True:
            await asyncio.sleep(3600)
    asyncio.run(run_server())

# --- MAIN BATCH JOB LOOP ---
def main_job_loop():
    if not r or not client:
        print("Worker exiting: Redis or Docker is not available.")
        return
    os.makedirs(TEMP_DIR_IN_WORKER, exist_ok=True)
    
    print("Worker started. Waiting for batch jobs...")
    while True:
        try:
            _, job_id = r.brpop("job_queue")
            job_json = r.get(f"job_{job_id}")
            if not job_json: continue
            job_data = json.loads(job_json)
            job_data["status"] = "running"
            r.set(f"job_{job_id}", json.dumps(job_data))
            output = execute_code_in_container(job_id, job_data["code"], job_data["language"], job_data.get("stdin"))
            job_data["output"] = output
            job_data["status"] = "completed"
            r.set(f"job_{job_id}", json.dumps(job_data))
            r.publish(f"job_updates_{job_id}", json.dumps(job_data))
            print(f"Job {job_id} completed.")
        except redis.exceptions.ConnectionError:
            print("Redis connection lost. Reconnecting in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"An error occurred: {e}")
            time.sleep(5)

if __name__ == "__main__":
    ws_thread = threading.Thread(target=start_websocket_server, daemon=True)
    ws_thread.start()
    main_job_loop()
