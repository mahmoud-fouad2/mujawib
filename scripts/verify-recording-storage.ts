import 'server-only'

import {
  recordingStorageProblem,
  recordingStorageReady,
  verifyRecordingStorageAccess,
} from '@/server/storage/recordings'

const problem = recordingStorageProblem()
if (problem) {
  console.error(`Recording storage configuration is invalid: ${problem}`)
  process.exitCode = 1
} else if (!recordingStorageReady()) {
  console.error('Recording storage is disabled. Configure the private bucket, then enable it.')
  process.exitCode = 1
} else {
  try {
    await verifyRecordingStorageAccess()
    console.log('Private recording storage verified: Put/Get/Delete succeeded.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown storage error'
    console.error(`Recording storage verification failed: ${message}`)
    process.exitCode = 1
  }
}
