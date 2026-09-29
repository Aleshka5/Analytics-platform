# Analytics-platform
Test Task for FreeDom

## Run

- `make` or `make up` — build both images and start the API and page containers.
- `make build` — build the API and page images.
- `make down` — stop and remove both containers.
- `make test` — build both images if needed, then run pytest and Vitest.

The health check is `http://localhost:8000/health` (the port is `API_PORT` in `.env`). The page is `http://localhost:5173` (the host port is `WEB_PORT` in `.env`; the container still listens on 5173).

Both containers join the Podman network `analitics_platform_network`. On that network the API name is `analytics-api` and the page name is `analytics-web`.
