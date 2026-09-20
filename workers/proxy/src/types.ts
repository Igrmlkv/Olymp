export interface Env {
  DB: D1Database
  PACKAGES: R2Bucket
  TELEMETRY: AnalyticsEngineDataset
  ANTHROPIC_API_KEY: string
  ENVIRONMENT: string
  MODEL_HINTS: string
}
