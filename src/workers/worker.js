import http from 'node:http'
import {PORT, SIMULATED_IO_DELAY, ERROR_PROBABILITY, SHUTDOWN_TIMEOUT} from '../config/constants.js'

let isShuttingDown = false

const server = http.createServer(async (req, res) => {
    if (req.url === '/escribir-evidencia' && req.method === 'POST') {
        if (isShuttingDown) {
            res.writeHead(503, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({error: 'Server is shutting down'}))
            return
        }

        // Heavy I/O simulation (3000 ms)
        await new Promise((resolve) => setTimeout(resolve, SIMULATED_IO_DELAY))

        // Post-writing anomaly simulation (50% probability)
        if (Math.random() < ERROR_PROBABILITY) {
            console.error(`[WORKER ${process.pid}] Anomaly detected. Exiting with code 1`)
            process.exit(1)
        }

        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({
            status: 'success',
            message: 'Evidence written successfully',
            workerPid: process.pid,
            timestamp: Date.now()
        }))
        return
    }

    res.writeHead(404, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: 'Not found'}))
})

server.listen(PORT, () => {
    console.log(`[WORKER] PID: ${process.pid} listening on port ${PORT}`)
})

// IPC mapping and graceful shutdown
process.on('message', (msg) => {
    if (msg === 'shutdown') {
        isShuttingDown = true
        console.log(`[WORKER ${process.pid}] Received shutdown signal. Closing server...`)

        // 10-second safety timeout
        const forceTimeout = setTimeout(() => {
            console.error(`[WORKER ${process.pid}] Force shutdown due to timeout`)
            process.exit(0)
        }, SHUTDOWN_TIMEOUT)

        server.close(() => {
            clearTimeout(forceTimeout)
            console.log(`[WORKER ${process.pid}] Server closed cleanly. Exiting with code 0`)
            process.exit(0)
        })
    }
})