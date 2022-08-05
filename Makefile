test:
	docker-compose run extension-tests yarn test:jest

test-watch:
	docker-compose run extension-tests yarn test:jest --watch 

build: 
	docker build . -t browser-extension-tests:latest

run:
	docker run --rm browser-extension-tests:latest  