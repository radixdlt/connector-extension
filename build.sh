#!/bin/sh

set -e

ENV=$1

NAME="$ENV--radix-connector"
DEV_NAME="$ENV--radix-connector-with-dev-tools"

npm run build:${ENV}
mv dist $NAME

DEV_TOOLS=true npm run build:${ENV}
mv dist $DEV_NAME

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}