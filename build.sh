#!/bin/sh

set -e

NAME="radix-connector"
DEV_NAME="radix-connector-with-dev-tools"

npm run build
mv dist $NAME

DEV_TOOLS=true npm run build
mv dist $DEV_NAME

cat radix-connector/manifest.json
cat radix-connector-with-dev-tools/manifest.json

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}