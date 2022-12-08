#!/bin/sh

set -e

rm -rf radix-connect radix-connect-dev radix-connect.zip radix-connect-dev.zip

NAME="radix-connect"
DEV_NAME="radix-connect-dev"

yarn build:beta
mv dist $NAME

DEV_TOOLS=true yarn build:beta
mv dist $DEV_NAME

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}




