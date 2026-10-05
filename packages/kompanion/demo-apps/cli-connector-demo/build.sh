#!/usr/bin/env bash
# Builds the demo app on the three Camel versions, into target/<camel.version>/ (classes + lib/).
# 4.23.0-SNAPSHOT (the only one with the WebSocket transport) must be in the local Maven repository.
set -euo pipefail
cd "$(dirname "$0")"
MVN="../../mvnw"
for version in "${@:-4.18.4 4.22.1 4.23.0-SNAPSHOT}"; do
  for v in $version; do
    echo "== Camel $v"
    "$MVN" -q -f pom.xml package -Dcamel.version="$v"
  done
done
