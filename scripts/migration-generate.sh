#!/bin/bash
# Wrapper script to simplify migration generation
# Usage: pnpm migration:generate MigrationName

if [ -z "$1" ]; then
  echo "Error: Migration name is required"
  echo "Usage: pnpm migration:generate MigrationName"
  exit 1
fi

MIGRATION_NAME="$1"
MIGRATION_PATH="src/migrations/${MIGRATION_NAME}"

ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate -d src/data-source.ts "${MIGRATION_PATH}"

