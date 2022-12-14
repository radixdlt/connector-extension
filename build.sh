#!/bin/sh

set -e

rm -rf radix-connector radix-connector-dev radix-connector.zip radix-connector-dev.zip

NAME="radix-connector"
DEV_NAME="radix-connector-dev"

yarn build:beta
mv dist $NAME

DEV_TOOLS=true yarn build:beta
mv dist $DEV_NAME

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}




