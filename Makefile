test:
	docker run --rm browser-extension-tests:latest yarn test

test-watch:
	docker run --rm -it browser-extension-tests:latest yarn test:watch

build: 
	docker build . -t browser-extension-tests:latest
