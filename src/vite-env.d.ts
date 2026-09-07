/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of a real, running HYDRA-UMC-DATALAKE instance. See App.tsx. */
  readonly VITE_DATALAKE_URL?: string
  /** Base URL of a real, running HYDRA-UMC-ANOMALY-DETECTOR instance. See App.tsx. */
  readonly VITE_ANOMALY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
