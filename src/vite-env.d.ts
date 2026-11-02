/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of a real, running HYDRA-UMC-DATALAKE instance. See App.tsx. */
  readonly VITE_DATALAKE_URL?: string
  /** Base URL of a real, running HYDRA-UMC-ANOMALY-DETECTOR instance. See App.tsx. */
  readonly VITE_ANOMALY_URL?: string
  /** "true" allows the remaining-useful-life card (off otherwise; the card also needs the running server to have it open); see src/lib/rulConfig.ts for the other VITE_RUL_* values. */
  readonly VITE_RUL_ENABLED?: string
  readonly VITE_RUL_URL?: string
  readonly VITE_RUL_SOURCE_ID?: string
  readonly VITE_RUL_KIND?: string
  readonly VITE_RUL_FIELD?: string
  readonly VITE_RUL_LIMIT?: string
  readonly VITE_RUL_POINTS?: string
  readonly VITE_RUL_WARN_DAYS?: string
  readonly VITE_RUL_CRITICAL_DAYS?: string
  readonly VITE_RUL_TIMEOUT_MS?: string
  /** "true" lets the Trend Summary ask the language model of the cognitive node for its sentence (off otherwise); see src/lib/aiConfig.ts. */
  readonly VITE_COGNITIVE_ENABLED?: string
  readonly VITE_COGNITIVE_URL?: string
  readonly VITE_COGNITIVE_TIMEOUT_MS?: string
  /** "true" shows the Fleet card (off otherwise). */
  readonly VITE_FLEET_ENABLED?: string
  readonly VITE_FLEET_REFRESH_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
