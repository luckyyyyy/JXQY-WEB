#!/usr/bin/env bash
# Check that every @Router() class is registered in its module's providers.
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
    module_file="$(find "$module_dir" -maxdepth 1 -name '*.module.ts' | head -1)"

    if [ -z "$module_file" ]; then
      echo "ERROR: No *.module.ts found for $router_file ($class_name)"
      EXIT_CODE=1
      continue
    fi

    if ! grep -q "$class_name" "$module_file"; then
      echo "ERROR: $class_name (in $router_file) not found in $module_file providers"
      EXIT_CODE=1
    fi
  done < <(grep -A1 '@Router' "$router_file" | grep -oP 'class\s+\K\w+')

done < <(find "$MODULES_DIR" -name '*.router.ts' -not -path '*/dist/*')

if [ $EXIT_CODE -eq 0 ]; then
  echo "OK: All routers are registered in their module providers."
fi

exit $EXIT_CODE
