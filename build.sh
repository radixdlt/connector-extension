#!/bin/sh

set -e

yarn build

NAME="radix-connect-$1"

mv dist $NAME

zip -9 -y -r -q ${NAME}.zip ${NAME}/