#!/bin/bash
# 将 WMV 视频转换为 WebM 格式（VP9 + Opus）
# 用法: ./convert-video.sh [input_dir] [output_dir]

INPUT_DIR="${1:-../resources/Content/video}"
OUTPUT_DIR="${2:-../resources/Content/video}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== WMV to WebM Video Converter ===${NC}"
echo "输入目录: $INPUT_DIR"
echo "输出目录: $OUTPUT_DIR"
echo ""

# 确保输出目录存在
mkdir -p "$OUTPUT_DIR"

# 统计
total=0
success=0
failed=0

# 遍历所有 wmv 文件
for wmv_file in "$INPUT_DIR"/*.wmv; do
    if [ ! -f "$wmv_file" ]; then
        echo -e "${YELLOW}没有找到 WMV 文件${NC}"
        exit 0
    fi

    ((total++))

    # 获取文件名（不含扩展名）
    filename=$(basename "$wmv_file" .wmv)
    output_file="$OUTPUT_DIR/${filename}.webm"

    # 如果输出文件已存在，跳过
    if [ -f "$output_file" ]; then
        echo -e "${YELLOW}[跳过] $filename.webm 已存在${NC}"
        ((success++))
        continue
    fi

    echo -e "转换中: ${filename}.wmv -> ${filename}.webm"

    # 使用 FFmpeg 转换
    # -c:v libvpx-vp9: VP9 视频编码（WebM 标准）
    # -crf 30: 质量控制（0-63，越小质量越高，30 是较好的平衡）
    # -b:v 0: 启用恒定质量模式
    # -c:a libopus: Opus 音频编码
    # -b:a 128k: 音频比特率
    # -y: 覆盖已存在的文件
    if ffmpeg -i "$wmv_file" \
        -c:v libvpx-vp9 \
        -crf 30 \
        -b:v 0 \
        -c:a libopus \
        -b:a 128k \
        -y \
        "$output_file" \
        -loglevel warning 2>&1; then
        echo -e "${GREEN}[完成] $filename.webm${NC}"
        ((success++))
    else
        echo -e "${RED}[失败] $filename.wmv 转换失败${NC}"
        ((failed++))
    fi
done

echo ""
echo -e "${GREEN}=== 转换完成 ===${NC}"
echo "总计: $total 个文件"
echo -e "成功: ${GREEN}$success${NC}"
echo -e "失败: ${RED}$failed${NC}"

# 显示文件大小对比
echo ""
echo "文件大小对比:"
for wmv_file in "$INPUT_DIR"/*.wmv; do
    filename=$(basename "$wmv_file" .wmv)
    webm_file="$OUTPUT_DIR/${filename}.webm"
    if [ -f "$webm_file" ]; then
        wmv_size=$(du -h "$wmv_file" | cut -f1)
        webm_size=$(du -h "$webm_file" | cut -f1)
        echo "  $filename: $wmv_size (wmv) -> $webm_size (webm)"
    fi
done
