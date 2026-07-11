#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="$(npm root -g)"

echo "Building EIP 101..."
node eip-101.js

echo "Building EIP 201..."
node eip-201.js

echo "Done."
