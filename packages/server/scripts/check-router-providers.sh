#!/usr/bin/env bash
# Check that every @Router() class is imported (side-effect) in its module's index.ts.
# Run: bash packages/server/scripts/check-router-providers.sh

set -euo pipefail

MODULES_DIR="packages/server/src/modules"
EXIT_CODE=0

# Find all *.router.ts files
while IFS= read -r router_file; do
  # Extract class names decorated with @Router
  while IFS= read -r class_name; do
    [ -z "$class_name" ] && continue

    module_dir="$(dirname "$router_file")"
    index_file="$module_dir/index.ts"

    if [ ! -f "$index_file" ]; then
      echo "ERROR: No index.ts found for $router_file ($class_name)"
      EXIT_CODE=1
      continue
    fi

    # Check the router file is imported (side-effect import) in index.ts
    router_basename="$(basename "$router_file" .ts)"
    if ! grep -q "$router_basename" "$index_file"; then
      echo "ERROR: $router_basename (in $router_file) not imported in $index_file"
      EXIT_CODE=1
    fi
  done < <(grep -A1 '@Router' "$router_file" | grep -oP 'class\s+\K\w+')

done < <(find "$MODULES_DIR" -name '*.router.ts' -not -path '*/dist/*')

if [ $EXIT_CODE -eq 0 ]; then
  echo "OK: All routers are imported in their module index.ts."
fi

exit $EXIT_CODE
