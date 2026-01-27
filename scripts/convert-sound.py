#!/usr/bin/env python3
"""
Convert XNA/MonoGame XNB sound files to OGG format for web browsers.

OGG Vorbis is preferred over MP3 because:
- No end-of-file padding issues (no audio pop/click)
- Better quality at same bitrate
- Open format with good browser support

XNB SoundEffect format:
- Header: "XNBw" (Windows) or "XNBx" (Xbox) etc.
- Version byte
- Flags byte
- Compressed size (4 bytes, little-endian)
- Type readers section
- Content section with PCM audio data

Requires ffmpeg for OGG conversion.

Usage:
    python convert-sound.py [input_dir] [output_dir]

Example:
    python convert-sound.py ../resources/Content/sound ../resources/Content/sound
"""

import os
import sys
import struct
import wave
import subprocess
import tempfile

def read_7bit_encoded_int(data, offset):
    """Read a 7-bit encoded integer (LEB128 variant used by XNB)."""
    result = 0
    shift = 0
    while True:
        byte = data[offset]
        offset += 1
        result |= (byte & 0x7F) << shift
        if (byte & 0x80) == 0:
            break
        shift += 7
    return result, offset

def read_string(data, offset):
    """Read a length-prefixed string."""
    length, offset = read_7bit_encoded_int(data, offset)
    string = data[offset:offset + length].decode('utf-8')
    return string, offset + length

def convert_xnb_to_wav(input_path, output_path):
    """Convert XNB sound file to WAV format."""
    try:
        with open(input_path, 'rb') as f:
            data = f.read()

        # Check XNB header
        if data[:3] != b'XNB':
            print(f"  Skipping {input_path}: Not an XNB file")
            return False

        # Parse header
        platform = chr(data[3])  # 'w' = Windows, 'x' = Xbox, etc.
        version = data[4]
        flags = data[5]

        # Check if compressed
        is_compressed = (flags & 0x80) != 0
        if is_compressed:
            print(f"  Skipping {input_path}: Compressed XNB not supported")
            return False

        # File size
        file_size = struct.unpack('<I', data[6:10])[0]

        offset = 10

        # Read type readers count
        type_reader_count, offset = read_7bit_encoded_int(data, offset)

        # Skip type readers
        for _ in range(type_reader_count):
            type_name, offset = read_string(data, offset)
            reader_version = struct.unpack('<I', data[offset:offset + 4])[0]
            offset += 4

        # Read shared resource count
        shared_resource_count, offset = read_7bit_encoded_int(data, offset)

        # Read content type index (7-bit encoded)
        content_type, offset = read_7bit_encoded_int(data, offset)

        # Now we're at the SoundEffect data
        # Format for SoundEffect:
        # - Format chunk size (4 bytes)
        # - WAVEFORMATEX structure
        # - Data size (4 bytes)
        # - PCM data

        format_chunk_size = struct.unpack('<I', data[offset:offset + 4])[0]
        offset += 4

        # WAVEFORMATEX
        format_tag = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2
        channels = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2
        sample_rate = struct.unpack('<I', data[offset:offset + 4])[0]
        offset += 4
        avg_bytes_per_sec = struct.unpack('<I', data[offset:offset + 4])[0]
        offset += 4
        block_align = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2
        bits_per_sample = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2

        # Skip any extra format bytes
        extra_format_bytes = format_chunk_size - 18
        if extra_format_bytes > 0:
            offset += extra_format_bytes

        # Data size
        data_size = struct.unpack('<I', data[offset:offset + 4])[0]
        offset += 4

        # PCM data
        pcm_data = data[offset:offset + data_size]

        # Write to temp WAV file first, then convert to MP3
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_wav_path = tmp.name

        try:
            with wave.open(tmp_wav_path, 'wb') as wav:
                wav.setnchannels(channels)
                wav.setsampwidth(bits_per_sample // 8)
                wav.setframerate(sample_rate)
                wav.writeframes(pcm_data)

            # Convert WAV to OGG using ffmpeg
            # OGG Vorbis doesn't have the end-of-file padding issue that MP3 has
            result = subprocess.run([
                'ffmpeg', '-y', '-i', tmp_wav_path,
                '-acodec', 'libvorbis', '-q:a', '6',  # Quality 6 = ~192 kbps VBR
                output_path
            ], capture_output=True, text=True)

            if result.returncode != 0:
                print(f"  ffmpeg error: {result.stderr}")
                return False

            print(f"  Converted: {os.path.basename(input_path)} -> {os.path.basename(output_path)}")
            print(f"    Format: {channels}ch, {sample_rate}Hz, {bits_per_sample}bit")
            return True
        finally:
            # Clean up temp file
            if os.path.exists(tmp_wav_path):
                os.remove(tmp_wav_path)

    except Exception as e:
        print(f"  Error converting {input_path}: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        input_dir = "resources/Content/sound"
        output_dir = "resources/Content/sound"
    elif len(sys.argv) == 2:
        input_dir = sys.argv[1]
        output_dir = sys.argv[1]
    else:
        input_dir = sys.argv[1]
        output_dir = sys.argv[2]

    # Resolve paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    if not os.path.isabs(input_dir):
        input_dir = os.path.join(project_root, input_dir)
    if not os.path.isabs(output_dir):
        output_dir = os.path.join(project_root, output_dir)

    print(f"Converting XNB sound files to OGG...")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print()

    # Check ffmpeg is available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg is required but not found. Please install ffmpeg.")
        return 1

    if not os.path.exists(input_dir):
        print(f"Error: Input directory does not exist: {input_dir}")
        return 1

    os.makedirs(output_dir, exist_ok=True)

    converted = 0
    failed = 0
    skipped = 0

    for filename in os.listdir(input_dir):
        if not filename.lower().endswith('.xnb'):
            continue

        input_path = os.path.join(input_dir, filename)
        # Convert filename to lowercase for consistency
        output_filename = os.path.splitext(filename)[0].lower() + '.ogg'
        output_path = os.path.join(output_dir, output_filename)

        # Skip if output already exists
        if os.path.exists(output_path):
            skipped += 1
            continue

        if convert_xnb_to_wav(input_path, output_path):
            converted += 1
        else:
            failed += 1

    print()
    print(f"Done! Converted: {converted}, Skipped: {skipped}, Failed: {failed}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
