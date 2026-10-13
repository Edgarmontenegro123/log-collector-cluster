import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const logFilePath = path.join(__dirname, '../../app.log')

export const writeLog = (level, message) => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${level.toUpperCase}] [PID: ${process.pid}] ${message}\n`

    try {
        fs.appendFileSync(logFilePath, logEntry, 'utf8')
    } catch (error) {
        console.error(`[LOGGER ERROR] Failed to write log: ${error.message}`)
    }

    console.log(logEntry.trim())
}