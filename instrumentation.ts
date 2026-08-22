export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundWorker } = await import('./server/jobs/worker')
    startBackgroundWorker()
  }
}
