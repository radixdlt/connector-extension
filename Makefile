test:
	docker-compose run --rm tests npm run test

test-watch:
	docker-compose run --rm tests npm run test:watch

build: 
	docker build . -t browser-extension-tests:latest
