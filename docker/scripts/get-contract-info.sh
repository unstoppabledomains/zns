#!/usr/bin/env bash

set -exo pipefail

docker run --entrypoint "/bin/sh" -w /zns-contracts -v "$(pwd)":/zns-contracts derain/zilliqa-dev-node -c "/zns-contracts/scripts/contractInfo.sh"
