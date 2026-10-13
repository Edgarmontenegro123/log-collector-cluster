import http from 'node:http'
import {Worker} from 'node:worker_threads'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {PORT, ERROR_PROBABILITY, SHUTDOWN_TIMEOUT} from '../config/constants.js'
import {writeLog} from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let isShuttingDown = false

const runHeavyTaskInWorkerThread = () => {
    return new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'heavyComputation.js')
        const worker = new Worker(workerPath)

        worker.on('message', (message) => {
            resolve(message)
        })

        worker.on('error', (error) => {
            reject(error)
        })

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker thread stopped with exit code ${code}`))
            }
        })
    })
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/escribir-evidencia' && req.method === 'POST') {
        if (isShuttingDown) {
            writeLog('warn', 'Request rejected. Server is shutting down.')
            res.writeHead(503, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({error: 'Server is shutting down'}))
            return
        }

        try {
            writeLog('info', 'Executing heavy I/O and computation via worker thread...')

            // Heavy computation delegated to worker_threads (non-blocking event loop)
            await runHeavyTaskInWorkerThread()

            // Post-writing anomaly simulation (50% probability)
            if (Math.random() < ERROR_PROBABILITY) {
                writeLog('error', 'Anomaly detected. Exiting process with code 1.')
                process.exit(1)
            }

            // Generate clean human-readable timestamp
            const now = new Date()
            const readableTimestamp = now.toISOString().replace('T', ' ').substring(0, 19)

            writeLog('info', 'Evidence written and processed successfully.')
            res.writeHead(200, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({
                status: 'success',
                message: 'Evidence written successfully using worker threads',
                workerPid: process.pid,
                timestamp: readableTimestamp
            }))
        } catch (error) {
            writeLog('error', `Execution failed: ${error.message}`)
            res.writeHead(500, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({error: 'Internal server error'}))
        }
        return
    }

    res.writeHead(404, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: 'Not found'}))
})

server.listen(PORT, () => {
    writeLog('info', `Worker listening on port ${PORT}`)
})

// IPC mapping and graceful shutdown
process.on('message', (msg) => {
    if (msg === 'shutdown') {
        isShuttingDown = true
        writeLog('warn', 'Received shutdown signal. Closing server gracefully...')

        // 10-second safety timeout
        const forceTimeout = setTimeout(() => {
            writeLog('error', 'Force shutdown triggered due to safety timeout.')
            process.exit(0)
        }, SHUTDOWN_TIMEOUT)

        server.close(() => {
            clearTimeout(forceTimeout)
            writeLog('info', 'Server closed cleanly. Exiting with code 0.')
            process.exit(0)
        })
    }
})