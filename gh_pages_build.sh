#!/bin/sh

set -e

NAME="radix-connector"
DEV_NAME="radix-connector-dev"

LATEST_TAG=$(git describe --tags `git rev-list --tags --max-count=1`)

yarn build:beta
mv dist $NAME

DEV_TOOLS=true yarn build:beta
mv dist $DEV_NAME

zip --recurse-paths ${NAME}-${LATEST_TAG}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}-${LATEST_TAG}.zip ${DEV_NAME}

zip --recurse-paths ${NAME}.zip ${NAME}
zip --recurse-paths ${DEV_NAME}.zip ${DEV_NAME}

mv radix-connector*.zip docs/
