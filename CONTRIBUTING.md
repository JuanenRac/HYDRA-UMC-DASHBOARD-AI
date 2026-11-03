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

## Browser tests
The tests of the page in a real browser live in `e2e/` (Playwright with a pinned Chromium, plus axe-core). They run on the real build, made with the Fleet card switched on, and the two services it talks to are faked by the tests, so nothing needs to be running. Locally:

```bash
VITE_FLEET_ENABLED=true npm run build
cd e2e
npm ci
npx playwright install chromium
npx playwright test
```

The browser belongs to the exact version of `@playwright/test` in `e2e/package-lock.json`; to move to another version, change `e2e/package.json`, refresh the lock file and run the tests again. In the CI they have their own workflow (`browser-tests.yml`) so that a failed download of the browser does not turn the baseline red.
