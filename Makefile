.DEFAULT_GOAL := up

.PHONY: build up down test

API_IMAGE := analytics-api
WEB_IMAGE := analytics-web
NETWORK := analitics_platform_network

API_PORT := $(shell sed -n 's/^API_PORT=//p' .env 2>/dev/null)
ifeq ($(strip $(API_PORT)),)
API_PORT := 8000
endif

WEB_PORT := $(shell sed -n 's/^WEB_PORT=//p' .env 2>/dev/null)
ifeq ($(strip $(WEB_PORT)),)
WEB_PORT := 5173
endif

build:
	podman build -f backend/Containerfile -t $(API_IMAGE) backend
	podman build -f frontend/Containerfile -t $(WEB_IMAGE) frontend

up: build
	test -f .env || cp .env.example .env
	podman network exists $(NETWORK) || podman network create $(NETWORK)
	podman rm -f $(API_IMAGE) || true
	podman run -d --name $(API_IMAGE) --network $(NETWORK) --env-file .env -p $(API_PORT):$(API_PORT) $(API_IMAGE)
	podman rm -f $(WEB_IMAGE) || true
	podman run -d --name $(WEB_IMAGE) --network $(NETWORK) -p $(WEB_PORT):5173 $(WEB_IMAGE)

down:
	podman rm -f $(API_IMAGE) $(WEB_IMAGE) || true
	podman network exists $(NETWORK) && podman network rm $(NETWORK) || true

test: build
	podman run --rm $(API_IMAGE) pytest
	podman run --rm $(WEB_IMAGE) npm test
