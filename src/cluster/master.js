import cluster from 'node:cluster'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const runMaster = () => {
    const numCPUs = os.cpus().length
    console.log(`[MASTER] PID: ${process.pid} | Starting orchestration across ${numCPUs} cores...`)

    // Set the worker script path relative to this file
    cluster.setupPrimary({
        exec: path.join(__dirname, '../workers/worker.js')
    })

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork()
    }

    // Rolling restart function using IPC signal
    const rollingRestart = () => {
        console.log('[MASTER] Initiating rolling restart for workers...')
        const workers = Object.values(cluster.workers)

        const restartNext = (index) => {
            if (index >= workers.length) {
                console.log('[MASTER] Rolling restart completed successfully.')
                return
            }

            const worker = workers[index]
            if (worker) {
                console.log(`[MASTER] Sending shutdown signal to worker PID: ${worker.process.pid}`)
                worker.send('shutdown')

                worker.once('exit', () => {
                    cluster.fork()
                    // Wait a moment before restarting the next worker
                    setTimeout(() => restartNext(index + 1), 2000)
                })
            } else {
                restartNext(index + 1)
            }
        }

        restartNext(0)
    }

    // Capture SIGUSR2 signal for rolling restart
    process.on('SIGUSR2', () => {
        console.log('[MASTER] Received SIGUSR2 signal. Starting rolling restart...')
        rollingRestart()
    })

    // Self-healing policy: restart worker on abnormal exit (code !== 0)
    cluster.on('exit', (worker, code, signal) => {
        console.error(`[ALERTA] Worker PID: ${worker.process.pid} collapsed. Code: ${code} | Signal: ${signal}`)

        if (code !== 0) {
            console.log('[MASTER] Spawning a new worker due to self-healing policy...')
            cluster.fork()
        }
    })
}