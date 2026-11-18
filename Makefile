test:
	docker-compose run --rm tests pnpm run test:ci

test-watch:
	docker-compose run --rm tests pnpm run test

build: 
	docker build . -t browser-extension-tests:latest
