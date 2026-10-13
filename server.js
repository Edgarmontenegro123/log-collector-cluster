import cluster from 'node:cluster'
import {runMaster} from './src/cluster/master.js'

if (cluster.isPrimary) {
    runMaster()
} else {
    // Import worker logic when forked
    import('./src/workers/worker.js')
}