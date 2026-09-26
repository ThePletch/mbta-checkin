#!/bin/sh
set -e
cd "$(dirname "$0")"
exec npx vite
