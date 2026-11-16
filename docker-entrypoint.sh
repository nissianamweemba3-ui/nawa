#!/bin/sh
# Hosts mount persistent volumes owned by root. Give the data directory to the unprivileged "node" user,
# then run the server as that user.
set -eu
DATA_DIR="${DATA_DIR:-/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
exec "$@"
