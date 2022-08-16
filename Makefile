test:
	docker-compose run --rm tests yarn test

test-watch:
	docker-compose run --rm tests yarn test:watch

build: 
	docker build . -t browser-extension-tests:latest
