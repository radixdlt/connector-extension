#!/bin/sh

set -e

NAME="radix-connect"
DEV_NAME="radix-connect-dev"

LATEST_TAG=$(git describe --tags `git rev-list --tags --max-count=1`)

yarn build
mv dist $NAME

DEV_TOOLS=true yarn build
mv dist $DEV_NAME

zip --recurse-paths ${NAME}-${LATEST_TAG}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}-${LATEST_TAG}.zip ${DEV_NAME}

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}

mv radix-connect*.zip docs/
