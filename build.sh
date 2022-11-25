#!/bin/sh

set -e

NAME="radix-connect"
DEV_NAME="radix-connect-dev"

yarn build
mv dist $NAME

DEV_TOOLS=true yarn build
mv dist $DEV_NAME

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}




