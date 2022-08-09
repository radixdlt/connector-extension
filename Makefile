test:
	docker-compose run tests yarn test

test-watch:
	docker-compose run tests yarn test:watch

build: 
	docker build . -t browser-extension-tests:latest
