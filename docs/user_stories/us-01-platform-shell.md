# US-01 — Platform shell

**Depends on:** nothing.

## Story

As a developer, I want an empty API and an empty page that start with Podman and a Makefile, so that every later story has one place to run.

## In scope

- Makefile targets that build and start the API and the page with Podman.
- Both containers join the Podman network `analitics_platform_network` and reach each other by container name.
- `.env` read through pydantic-settings.
- API process exposes a health response and nothing else.
- React page in JavaScript loads and shows the product name only.
- pytest and Vitest run in the same environment.

## Out of scope

- Upload, cards, sidebar, table, export, and both language catalogs.
- Business routes from the [API contract](../api-contract.md).

## Definition of done

- `make` starts both processes, and the health URL returns success.
- Settings such as host, port, and the upload limit come from `.env`, with the 100 MB limit and the 60-minute lifetime present as settings even though no route uses them yet.
- The page opens in a browser and shows only the product name.
- `make test` runs pytest and Vitest, and both are green on this empty app.
- A short run note in the README matches the Makefile targets.

## Automated tests

- pytest: the health route returns success.
- Vitest: the page renders the product name.

## Manual check

1. Start the stack with the Makefile.
2. Open the health URL and confirm a success response.
3. Open the page and confirm it shows the product name and no report, upload zone, or sidebar.
4. Stop the stack with the Makefile and start it again.
