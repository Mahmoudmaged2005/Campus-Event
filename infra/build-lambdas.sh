#!/usr/bin/env bash
set -e

MODULES="auth events admin student notifications"
INFRA_FOLDER="$(cd "$(dirname "$0")" && pwd)"
BACKEND_FOLDER="$INFRA_FOLDER/../backend"

echo "Bundling every module into one file"
cd "$BACKEND_FOLDER"
rm -rf dist
npm run build:lambdas

for MODULE in $MODULES; do
  echo "Packing dist/$MODULE.zip"
  cd "$BACKEND_FOLDER/dist/$MODULE"
  python -m zipfile -c "../$MODULE.zip" index.mjs
done

echo "Done. The zip files are in backend/dist:"
ls -lh "$BACKEND_FOLDER/dist"/*.zip
