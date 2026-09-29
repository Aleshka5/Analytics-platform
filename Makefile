.DEFAULT_GOAL := up

.PHONY: build up down test

COMPOSE := podman compose

build:
	test -f .env || cp .env.example .env
	$(COMPOSE) build

up:
	test -f .env || cp .env.example .env
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down
	podman network exists analitics_platform_network && podman network rm analitics_platform_network || true

test:
	test -f .env || cp .env.example .env
	$(COMPOSE) build
	$(COMPOSE) run --rm -T --no-deps analytics-api pytest
	$(COMPOSE) run --rm -T --no-deps analytics-web npm test
