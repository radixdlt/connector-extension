#!/bin/sh

set -e

ENV=$1

NAME="$ENV--radix-connector"
DEV_NAME="$ENV--radix-connector-with-dev-tools"

yarn build:${ENV}
mv dist $NAME

DEV_TOOLS=true yarn build:${ENV}
mv dist $DEV_NAME

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}