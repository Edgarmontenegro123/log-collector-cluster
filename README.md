# Log Collector & Evidence Service (Cluster & Resiliency)

High-performance log collection backend built with Node.js core modules (`node:cluster`, `node:http`), demonstrating enterprise patterns such as **Self-Healing**, **Graceful Shutdown**, **IPC messaging**, and **Rolling Restarts**.

## Architecture & Design Patterns
- **Master-Worker Cluster (`node:cluster`):** Distributes incoming HTTP workloads across all available CPU cores, optimizing hardware resource utilization.
- **Self-Healing Policy:** Automatically detects abnormal worker exits (`code !== 0`) via the `cluster.on('exit')` event and immediately spawns a replacement node to guarantee API uptime.
- **Graceful Shutdown & Safety Timeout:** Listens to IPC messages from the master to close the HTTP server cleanly (`server.close()`), draining active requests before exiting, backed by a 10-second safety timeout.

---

## Technical Research & Scenario Analysis

### Scenario A: Worker Crash in Flight
1. **What status code or network error does the HTTP client receive?**
    - When a worker process abruptly executes `process.exit(1)` or crashes due to an uncaught exception while handling a request in flight, the active TCP socket is forcefully terminated. The HTTP client receives a network error such as `ECONNRESET` or `Socket hang up`, since the server drops the connection before sending valid HTTP headers or a status code.
2. **What happens to the data the request was trying to persist? Did the transaction complete?**
    - Although the Master process revives a new worker within milliseconds, the memory state and execution context of the crashed request are lost. If the asynchronous I/O persistence operation (e.g., writing to disk) was interrupted mid-way or hadn't fully completed before `process.exit(1)`, the transaction fails or leaves partial/corrupted data on the file system, as the process died prior to finalizing the write stream.

### Scenario B: OS-Level Forced Interruption (`SIGKILL` vs. `SIGTERM`)
1. **Why can't the Worker execute its `server.close()` hooks or IPC message handlers under a `SIGKILL` (`kill -9`)?**
    - A `SIGKILL` signal is handled directly by the operating system kernel and cannot be caught, blocked, or ignored by the Node.js process. Because the OS immediately terminates the process memory space, no JavaScript event loop ticks or cleanup hooks (like `server.close()` or `process.on('message')`) can execute.
2. **Compare `kill -9` against the Graceful Shutdown flow triggered by the Master's `SIGUSR2` signal.**
    - `kill -9` causes an instant, ungraceful termination resulting in dropped client connections and potential data corruption. In contrast, the `SIGUSR2` signal triggers a controlled `Rolling Restart` via IPC, where the master instructs the worker to stop accepting *new* connections, finish processing requests in flight, cleanly close sockets, and exit safely with code `0`.

### Scenario C: The "At-Least-Once" vs. "At-Most-Once" Dilemma
- **Problem:** If a client implements a retry pattern (`Retry` upon a network error like `ECONNRESET`) and resends the request, but the previous worker actually managed to write the log/evidence to disk just milliseconds before crashing (failing only to send back the `200 OK` response), a **data duplication or inconsistency** issue occurs. The operation is executed twice on the server side.
- **Production Solution:** To resolve this dilemma, production systems implement **Idempotency** using unique identifiers (**UUIDs** / idempotency keys). Every request includes a unique tracking token; the storage layer verifies if the token has already been processed. If a retry arrives with an already registered UUID, the server skips duplicate writing and safely returns the cached success response.

---

## Execution Guide
1. Start the server cluster:
   ```bash
   npm start
   ```
   
2. Test the evidence ingestion route (POST):
   ```bash
    curl -X POST http://localhost:8090/escribir-evidencia
   ```
   
3. Trigger a Rolling Restart from another terminal using SIGUSR2:
   ```bash
    kill -SIGUSR2 <MASTER_PID>
   ```
   
--- 