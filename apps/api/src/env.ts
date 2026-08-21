// Imported first (side-effect only) so its env vars are set before any
// other module reads process.env at import time. Local dev convenience
// only — production (Docker) sets real env vars via docker-compose
// `environment:` and ships no .env file, so this is a silent no-op there.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fine in production
}
