# Contributing to HYDRA-UMC-DASHBOARD-AI 🦾

We welcome contributions to the AI-powered analytical extension for the STUDIO web dashboard.

## Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS.
- **Backend**: Python 3.12 (Analytics engine), FastAPI.
- **AI Models**: Quantized Llama-3 (for summarization), scikit-learn (for trend analysis).
- **Data Fetching**: React Query, InfluxDB API.

## Guidelines
1. **Insight Accuracy**: All AI-generated insights must be grounded in real telemetry data from the `HYDRA-UMC-DATALAKE`.
2. **UI Consistency**: Follow the styling and component patterns used in the main `HYDRA-UMC-STUDIO` project.
3. **Data Privacy**: Ensure that AI processing of telemetry does not leak sensitive production information to external logs.
4. **Testing**: Validate dashboard widgets using simulated data from the `SYNTHETIC-DATA-GEN` tool to ensure layout stability under diverse telemetry conditions.
