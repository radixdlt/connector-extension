test:
	docker-compose run browser-extension-tests yarn test:jest

test-watch:
	docker-compose run browser-extension-tests yarn test:watch

build: 
	docker build . -t browser-extension-tests:latest
