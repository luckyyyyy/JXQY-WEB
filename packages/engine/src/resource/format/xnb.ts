/**
 * XNB 音频文件解析器
 *
 * XNB 是 XNA/MonoGame 的二进制资源容器格式。
 * 本模块实现了 SoundEffect 类型的解析，将其转换为 Web Audio API 可用的 PCM 数据。
 *
 * XNB SoundEffect 格式:
 * - Header: "XNBw" (Windows) / "XNBx" (Xbox) / "XNBm" (Mobile)
 * - Version byte
 * - Flags byte (0x80 = compressed)
 * - File size (4 bytes, little-endian)
 * - Type readers section
 * - Content section with WAVEFORMATEX + PCM data
 */

export interface XnbAudioData {
  /** 采样率 (Hz) */
  sampleRate: number;
  /** 声道数 */
  channels: number;
  /** 每样本位数 */
  bitsPerSample: number;
  /** PCM 数据 */
  pcmData: ArrayBuffer;
  /** 时长 (秒) */
  duration: number;
}

export interface XnbParseResult {
  success: boolean;
  data?: XnbAudioData;
  error?: string;
}

/**
 * 读取 7-bit 编码的整数 (LEB128 变体，XNB 专用)
 */
function read7BitEncodedInt(data: DataView, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let currentOffset = offset;

  while (true) {
    const byte = data.getUint8(currentOffset);
    currentOffset++;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }

  return [result, currentOffset];
}

/**
 * 读取长度前缀字符串
 */
function readString(data: DataView, offset: number): [string, number] {
  const [length, newOffset] = read7BitEncodedInt(data, offset);
  const bytes = new Uint8Array(data.buffer, data.byteOffset + newOffset, length);
  const decoder = new TextDecoder("utf-8");
  const str = decoder.decode(bytes);
  return [str, newOffset + length];
}

/**
 * 解析 XNB 音频文件
 * @param buffer XNB 文件的 ArrayBuffer
 * @returns 解析结果，包含 PCM 数据或错误信息
 */
export function parseXnbAudio(buffer: ArrayBuffer): XnbParseResult {
  try {
    const data = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // 检查 XNB 头
    if (uint8[0] !== 0x58 || uint8[1] !== 0x4e || uint8[2] !== 0x42) {
      // 'X', 'N', 'B'
      return { success: false, error: "不是有效的 XNB 文件" };
    }

    // 平台标识: 'w' = Windows, 'x' = Xbox, 'm' = Mobile
    const platform = String.fromCharCode(uint8[3]);
    if (!["w", "x", "m", "a"].includes(platform)) {
      return { success: false, error: `不支持的 XNB 平台: ${platform}` };
    }

    // 版本
    const version = uint8[4];
    if (version < 4 || version > 5) {
      return { success: false, error: `不支持的 XNB 版本: ${version}` };
    }

    // 标志位
    const flags = uint8[5];
    const isCompressed = (flags & 0x80) !== 0;
    if (isCompressed) {
      return { success: false, error: "不支持压缩的 XNB 文件 (LZX/LZ4)" };
    }

    // 文件大小
    // const fileSize = data.getUint32(6, true);

    let offset = 10;

    // 读取类型读取器数量
    const [typeReaderCount, offset1] = read7BitEncodedInt(data, offset);
    offset = offset1;

    // 跳过类型读取器
    for (let i = 0; i < typeReaderCount; i++) {
      const [, offset2] = readString(data, offset);
      offset = offset2;
      // 跳过读取器版本号 (4 bytes)
      offset += 4;
    }

    // 读取共享资源数量
    const [, offset3] = read7BitEncodedInt(data, offset);
    offset = offset3;

    // 读取内容类型索引
    const [, offset4] = read7BitEncodedInt(data, offset);
    offset = offset4;

    // 现在我们在 SoundEffect 数据位置
    // 格式:
    // - Format chunk size (4 bytes)
    // - WAVEFORMATEX 结构
    // - Data size (4 bytes)
    // - PCM 数据

    const formatChunkSize = data.getUint32(offset, true);
    offset += 4;

    // WAVEFORMATEX 结构 (最小 18 字节):
    // - formatTag: 2 bytes
    // - channels: 2 bytes
    // - sampleRate: 4 bytes
    // - avgBytesPerSec: 4 bytes
    // - blockAlign: 2 bytes
    // - bitsPerSample: 2 bytes
    // - cbSize: 2 bytes (扩展字节数，可能不存在于旧格式)
    const waveFormatStart = offset;

    const formatTag = data.getUint16(offset, true);
    offset += 2;

    // formatTag: 1 = PCM, 2 = ADPCM, 0x0161 = WMA
    if (formatTag !== 1 && formatTag !== 2) {
      return {
        success: false,
        error: `不支持的音频格式: 0x${formatTag.toString(16)} (仅支持 PCM)`,
      };
    }

    const channels = data.getUint16(offset, true);
    offset += 2;

    const sampleRate = data.getUint32(offset, true);
    offset += 4;

    // 平均字节率
    // const avgBytesPerSec = data.getUint32(offset, true);
    offset += 4;

    // 块对齐
    // const blockAlign = data.getUint16(offset, true);
    offset += 2;

    const bitsPerSample = data.getUint16(offset, true);
    offset += 2;

    // 跳过 format chunk 的剩余字节（包括 cbSize 和任何扩展数据）
    // formatChunkSize 指定了整个格式块的大小
    const bytesRead = offset - waveFormatStart;
    const remainingFormatBytes = formatChunkSize - bytesRead;
    if (remainingFormatBytes > 0) {
      offset += remainingFormatBytes;
    }

    // 数据大小
    const dataSize = data.getUint32(offset, true);
    offset += 4;

    // PCM 数据
    const pcmData = buffer.slice(offset, offset + dataSize);

    // 计算时长
    const bytesPerSample = bitsPerSample / 8;
    const totalSamples = dataSize / (channels * bytesPerSample);
    const duration = totalSamples / sampleRate;

    return {
      success: true,
      data: {
        sampleRate,
        channels,
        bitsPerSample,
        pcmData,
        duration,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `解析 XNB 失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 将 XNB 音频数据转换为 AudioBuffer (Web Audio API)
 * @param audioData XNB 解析出的音频数据
 * @param audioContext Web Audio API 上下文
 * @returns AudioBuffer
 */
export function xnbToAudioBuffer(
  audioData: XnbAudioData,
  audioContext: AudioContext | OfflineAudioContext
): AudioBuffer {
  const { sampleRate, channels, bitsPerSample, pcmData } = audioData;

  // 计算样本数
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = pcmData.byteLength / (channels * bytesPerSample);

  // 创建 AudioBuffer
  const audioBuffer = audioContext.createBuffer(channels, totalSamples, sampleRate);

  // 将 PCM 数据转换为 Float32
  const view = new DataView(pcmData);

  for (let channel = 0; channel < channels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let i = 0; i < totalSamples; i++) {
      const sampleIndex = i * channels + channel;
      const byteOffset = sampleIndex * bytesPerSample;

      let sample: number;

      if (bitsPerSample === 8) {
        // 8-bit unsigned
        sample = (view.getUint8(byteOffset) - 128) / 128;
      } else if (bitsPerSample === 16) {
        // 16-bit signed
        sample = view.getInt16(byteOffset, true) / 32768;
      } else if (bitsPerSample === 24) {
        // 24-bit signed (little-endian)
        const b0 = view.getUint8(byteOffset);
        const b1 = view.getUint8(byteOffset + 1);
        const b2 = view.getUint8(byteOffset + 2);
        let value = b0 | (b1 << 8) | (b2 << 16);
        if (value & 0x800000) value |= 0xff000000; // 符号扩展
        sample = value / 8388608;
      } else if (bitsPerSample === 32) {
        // 32-bit signed
        sample = view.getInt32(byteOffset, true) / 2147483648;
      } else {
        sample = 0;
      }

      channelData[i] = sample;
    }
  }

  return audioBuffer;
}

/**
 * 将 XNB 音频转换为 WAV Blob (用于下载或 Audio 元素播放)
 * @param audioData XNB 解析出的音频数据
 * @returns WAV 格式的 Blob
 */
export function xnbToWavBlob(audioData: XnbAudioData): Blob {
  const { sampleRate, channels, bitsPerSample, pcmData } = audioData;

  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;

  // WAV 文件头 (44 bytes)
  const headerSize = 44;
  const wavBuffer = new ArrayBuffer(headerSize + pcmData.byteLength);
  const view = new DataView(wavBuffer);
  const uint8 = new Uint8Array(wavBuffer);

  // RIFF header
  uint8.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, 36 + pcmData.byteLength, true); // 文件大小 - 8
  uint8.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt subchunk
  uint8.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, channels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data subchunk
  uint8.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, pcmData.byteLength, true); // Subchunk2Size

  // PCM data
  uint8.set(new Uint8Array(pcmData), 44);

  return new Blob([wavBuffer], { type: "audio/wav" });
}
