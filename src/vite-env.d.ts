/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of a real, running HYDRA-UMC-DATALAKE instance. See App.tsx. */
  readonly VITE_DATALAKE_URL?: string
  /** Base URL of a real, running HYDRA-UMC-ANOMALY-DETECTOR instance. See App.tsx. */
  readonly VITE_ANOMALY_URL?: string
  /** "true" switches on the remaining-useful-life card (off otherwise); see src/lib/rulConfig.ts for the other VITE_RUL_* values. */
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
