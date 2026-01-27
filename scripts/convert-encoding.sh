#!/bin/bash
# Convert all .ini and .txt files in resources folder from GB2312 to UTF-8
# 将 resources 目录下所有 .ini 和 .txt 文件从 GB2312 转换为 UTF-8
#
# Usage: ./convert-encoding.sh
#
# This script is idempotent - it will skip files that are already UTF-8.

set -e

RESOURCES_DIR="./resources"
CONVERTED=0
SKIPPED=0
FAILED=0

echo "🔄 开始转换 resources 目录中的 .ini 和 .txt 文件..."
echo "   从 GB2312/GBK 编码转换为 UTF-8"
echo ""

# Find all .ini and .txt files
while IFS= read -r -d '' file; do
    # Detect current encoding using file command
    encoding=$(file -bi "$file" | sed -e 's/.*charset=\([a-zA-Z0-9_-]*\).*/\1/')

    # Skip if already UTF-8 or ASCII
    if [[ "$encoding" == "utf-8" ]] || [[ "$encoding" == "us-ascii" ]]; then
        echo "⏭️  已是 UTF-8: $file"
        ((SKIPPED++)) || true
        continue
    fi

    # Create a temp file
    temp_file=$(mktemp)

    # Try to convert from GB2312/GBK to UTF-8
    if iconv -f GB2312 -t UTF-8 "$file" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$file"
        echo "✅ 已转换: $file (GB2312 → UTF-8)"
        ((CONVERTED++)) || true
    elif iconv -f GBK -t UTF-8 "$file" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$file"
        echo "✅ 已转换: $file (GBK → UTF-8)"
        ((CONVERTED++)) || true
    elif iconv -f GB18030 -t UTF-8 "$file" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$file"
        echo "✅ 已转换: $file (GB18030 → UTF-8)"
        ((CONVERTED++)) || true
    else
        rm -f "$temp_file"
        echo "❌ 转换失败: $file (编码: $encoding)"
        ((FAILED++)) || true
    fi
done < <(find "$RESOURCES_DIR" -type f \( -name "*.ini" -o -name "*.txt" \) -print0)

echo ""
echo "🎉 转换完成!"
echo "   转换文件数: $CONVERTED"
echo "   跳过文件数: $SKIPPED"
echo "   失败文件数: $FAILED"
