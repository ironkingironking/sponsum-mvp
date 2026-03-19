.PHONY: dev build check db-up db-down

dev:
	npm run dev

build:
	npm run build

check:
	npm run check

db-up:
	docker compose up -d postgres

db-down:
	docker compose stop postgres
