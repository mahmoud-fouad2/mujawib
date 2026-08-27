export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Runs once, only when a server process actually starts serving traffic —
    // unlike lib/env.ts, which also loads during `next build`, where
    // NODE_ENV is always 'production' regardless of .env.local's
    // dev-appropriate localhost URLs. This is the right boundary for a check
    // that must fire against a real deploy but never against a local build.
    const { env } = await import('./lib/env')
    if (env.NODE_ENV === 'production') {
      const { appUrlProblem } = await import('./lib/app-url')
      const problem = appUrlProblem(env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL)
      // Refuses to boot rather than serving a health check that passes while
      // login sends every browser to a URL that does not exist outside the
      // container — see lib/app-url.ts for the incident this is.
      if (problem) throw new Error(problem)

      const { recordingStorageProblem } = await import('./server/storage/recordings')
      const storageProblem = recordingStorageProblem()
      if (storageProblem) throw new Error(storageProblem)
    }

    const { startBackgroundWorker } = await import('./server/jobs/worker')
    startBackgroundWorker()

    const { checkSecretDrift } = await import('./server/security/secret-drift')
    void checkSecretDrift()
  }
}
