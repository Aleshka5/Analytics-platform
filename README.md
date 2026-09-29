# Analytics Platform

Internal tool for uploading a table and reading a report over it. The API is Python (FastAPI, pandas). The page is a single React app. Configuration lives in `.env` and is loaded with pydantic-settings.

## Quick start

You need [Podman](https://podman.io/) with the compose plugin, or [Docker](https://docs.docker.com/compose/) with Compose. Copy the example env file if you do not already have one:

```bash
cp .env.example .env
```

`make up` copies `.env.example` for you when `.env` is missing. A plain `docker compose` invocation does not.

### Podman

```bash
make up
```

That runs `podman compose up -d --build`: it builds the API and page images and starts both containers.

| Command | What it does |
| --- | --- |
| `make` or `make up` | Build and start the API and the page in the background |
| `make build` | Build both images |
| `make down` | Stop and remove both containers and the project network |
| `make test` | Build both images, then run pytest and Vitest |

### Docker Compose

```bash
docker compose up -d --build
docker compose down
```

Tests through the Makefile always use Podman (`podman compose`). With Docker, run the same checks inside the built images:

```bash
docker compose build
docker compose run --rm --no-deps -v "$(pwd)/data:/data:ro" analytics-api pytest
docker compose run --rm --no-deps analytics-web npm test
```

### After startup

| Surface | URL |
| --- | --- |
| Page | http://localhost:5173 |
| API health | http://localhost:8000/health |

`WEB_PORT` and `API_PORT` in `.env` change the host ports. The page container still listens on 5173 inside the network. Both containers join `analitics_platform_network` and reach each other as `analytics-api` and `analytics-web`.

## About the project

Open the page, drop a file, and the report fills in one card at a time. There is no login. A parsed table stays in the API process for 60 minutes (`DATASET_TTL_MINUTES`).

- **Upload.** CSV, TSV, Excel (`.xlsx`, `.xls`), JSON, and Parquet, up to 100 MB. A workbook with several sheets asks which sheet to use. Replacing a file keeps the current report until the new file is ready.
- **Base report.** Ten cards: preview, columns, size, types, missing values, summary, top and worst, grouping, dynamics, and short insights. A block that cannot be calculated stays on the page as a message, and the rest of the report still loads.
- **Column selectors.** Ranking, grouping, and dynamics start from suggested columns. Switching a selector reloads that card only. The report always describes the whole file.
- **Data window.** A side panel sets filters, up to three sorts, and grouping (merged cells or aggregated rows). Apply opens a scrollable table, 100 rows at a time, with zoom.
- **Export.** The report downloads as Excel or PDF. The data window downloads every matching row as Excel, CSV, or JSON.
- **Languages.** English and Russian. The first visit follows the browser language. The header switch is remembered and refetches insight and error text.

## For future

Ideas that would make the current product more reliable or more useful. None of them are in scope of the shipped behavior.

- **Shared dataset store.** Parsed tables live in one API process. A restart drops them, and a second worker cannot see uploads handled by the first. Redis (or another shared store) keyed by `dataset_id`, with the same 60-minute TTL, would keep the HTTP contract and survive a restart. See [docs/for-future.md](docs/for-future.md).
- **Access control.** Anyone who has a dataset id can read it until it expires. Accounts, or a short-lived token bound to the upload, would stop that id from acting as a bearer secret.
- **Report that follows the filters.** The ten report cards always describe the full file. Rebuilding them from the applied filter, sort, and grouping would make the cards and the data window describe the same slice.
- **Larger files.** The 100 MB cap and the in-memory table bound what one process can hold. Streaming parse, or a store that pages rows from disk, would raise that limit without holding the whole frame in RAM.
- **End-to-end checks.** pytest and Vitest cover the API and the page in isolation. A browser suite would lock the upload, report sequence, data window, and both exports together.
