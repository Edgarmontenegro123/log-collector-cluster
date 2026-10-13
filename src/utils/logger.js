import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const logFilePath = path.join(__dirname, '../../app.log')

export const writeLog = (level, message) => {
    const now = new Date()
    // (YYYY-MM-DD HH:mm:ss)
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19)
    const formattedLevel = level.toUpperCase()

    const logEntry = `[${timestamp}] [${formattedLevel}] [PID: ${process.pid}] ${message}\n`

    try {
        fs.appendFileSync(logFilePath, logEntry, 'utf8')
    } catch (error) {
        console.error(`[LOGGER ERROR] Failed to write log: ${error.message}`)
    }

    console.log(logEntry.trim())
}