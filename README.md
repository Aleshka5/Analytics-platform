# Analytics-platform
Test Task for FreeDom

## Run

- `make` or `make up` — `podman compose up -d --build`: build both images and start the API and page containers.
- `make build` — `podman compose build`.
- `make down` — `podman compose down`: stop and remove both containers and their network.
- `make test` — build both images, then run pytest and Vitest.

The health check is `http://localhost:8000/health` (the port is `API_PORT` in `.env`). The page is `http://localhost:5173` (the host port is `WEB_PORT` in `.env`; the container still listens on 5173).

Both containers join the Podman network `analitics_platform_network`. On that network the API name is `analytics-api` and the page name is `analytics-web`.
