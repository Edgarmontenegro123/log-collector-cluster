import {parentPort} from 'node:worker_threads'
import crypto from 'node:crypto'

// Heavy cryptographic hash simulation to consume CPU cycles off the main thread
const performHeavyComputation = () => {
    let hash = 'initial_seed'
    for (let i = 0; i < 500000; i++) {
        hash = crypto.createHash('sha256').update(hash + i).digest('hex')
    }
    return hash
}

const result = performHeavyComputation()

// Send back the result to the main worker thread
parentPort.postMessage({success: true, hash: result})