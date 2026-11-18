#!/bin/sh

set -e

NAME="radix-connector"
DEV_NAME="radix-connector-with-dev-tools"

pnpm run build
mv dist $NAME

VITE_DEV_TOOLS=true pnpm run build
mv dist $DEV_NAME

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}