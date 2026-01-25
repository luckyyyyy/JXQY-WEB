#!/bin/bash
# Convert WMA music files to MP3 for browser compatibility
# Usage: ./convert-music.sh

MUSIC_DIR="resources/Content/music"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed."
    echo "Please install ffmpeg first:"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  macOS: brew install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    exit 1
fi

echo "Converting WMA files to MP3..."
echo "Source directory: $MUSIC_DIR"

# Count files
total=$(find "$MUSIC_DIR" -type f -name "*.wma" | wc -l)
current=0

# Convert each WMA file to MP3
find "$MUSIC_DIR" -type f -name "*.wma" | while read wma_file; do
    current=$((current + 1))
    basename=$(basename "$wma_file" .wma)
    mp3_file="${wma_file%.wma}.mp3"

    # Skip if MP3 already exists
    if [ -f "$mp3_file" ]; then
        echo "[$current/$total] Skipping (already exists): $(basename "$mp3_file")"
    else
        echo "[$current/$total] Converting: $(basename "$wma_file")"

        # Convert with good quality settings
        ffmpeg -i "$wma_file" -acodec libmp3lame -b:a 192k "$mp3_file" -loglevel error -y

        if [ $? -eq 0 ]; then
            echo "  ✓ Created: $(basename "$mp3_file")"
        else
            echo "  ✗ Failed to convert: $(basename "$wma_file")"
            continue
        fi
    fi

    # Create case-variant symlinks for compatibility
    # e.g., if MC001.mp3 exists, create Mc001.mp3 -> MC001.mp3
    dir=$(dirname "$mp3_file")
    base_lower=$(echo "$basename" | tr '[:upper:]' '[:lower:]')
    base_upper=$(echo "$basename" | tr '[:lower:]' '[:upper:]')

    # Create lowercase variant if basename is not all lowercase
    if [ "$basename" != "$base_lower" ]; then
        ln -sf "$(basename "$mp3_file")" "$dir/${base_lower}.mp3" 2>/dev/null
    fi

    # Create uppercase variant if basename is not all uppercase
    if [ "$basename" != "$base_upper" ]; then
        ln -sf "$(basename "$mp3_file")" "$dir/${base_upper}.mp3" 2>/dev/null
    fi
done

echo ""
echo "Conversion complete!"
echo "You can now delete the .wma files if desired (but keep them as backup)"
