# 音乐文件格式转换说明 / Music Format Conversion Guide

## 问题 / Problem

原始游戏使用 WMA 格式的音乐文件，但现代浏览器（Chrome、Firefox、Safari）不支持 WMA 格式。
The original game uses WMA format music files, but modern browsers (Chrome, Firefox, Safari) do not support WMA.

## 解决方案 / Solution

### 选项 1: 使用转换脚本（推荐）/ Option 1: Use Conversion Script (Recommended)

如果你已安装 ffmpeg，可以运行提供的脚本自动转换所有音乐：
If you have ffmpeg installed, run the provided script to automatically convert all music:

```bash
./convert-music.sh
```

**安装 ffmpeg / Installing ffmpeg:**

- **Ubuntu/Debian:** `sudo apt-get install ffmpeg`
- **macOS:** `brew install ffmpeg`
- **Windows:** 从 https://ffmpeg.org/download.html 下载

### 选项 2: 手动转换单个文件 / Option 2: Manually Convert Individual Files

```bash
ffmpeg -i resources/Content/music/Mc001.wma -acodec libmp3lame -b:a 192k resources/Content/music/Mc001.mp3
```

### 选项 3: 禁用音乐 / Option 3: Disable Music

如果不需要音乐，游戏会继续运行，只是没有背景音乐。
If music is not needed, the game will continue to run, just without background music.

## 自动播放权限 / Autoplay Permission

现代浏览器默认阻止音频自动播放。游戏现在会：
Modern browsers block audio autoplay by default. The game now will:

1. 在用户首次点击/触摸/按键后请求自动播放权限
2. 如果被拒绝，音乐将在下次用户交互后播放

Request autoplay permission after the first user click/touch/keypress.
If denied, music will play on the next user interaction.

## 音频格式优先级 / Audio Format Priority

代码会按以下顺序尝试加载音乐文件：
The code tries to load music files in this order:

1. `.mp3` - 最佳浏览器兼容性 / Best browser compatibility
2. `.ogg` - Firefox/Chrome 支持 / Supported by Firefox/Chrome
3. `.wma` - 仅 IE/Edge 支持 / Only IE/Edge (legacy)

## 文件编码问题 / File Encoding Issues

游戏文件（NPC 配置、脚本）使用 GB2312/GBK 编码（中文）。
Game files (NPC configs, scripts) use GB2312/GBK encoding (Chinese).

代码现在会：
The code now:

1. 首先尝试 GB2312 解码
2. 如果失败，尝试 GBK
3. 最后回退到 UTF-8

这修复了中文字符显示为乱码（如 "��Ӱ��"）的问题。
This fixes the issue where Chinese characters appeared as garbled text (like "��Ӱ��").

## 技术细节 / Technical Details

**修改的文件 / Modified Files:**

1. `packages/engine/src/audio/audio-manager.ts` - 音频管理器
   - 添加自动播放权限请求
   - 改进格式降级处理（MP3 优先）
   - 添加用户交互检测

2. `packages/engine/src/script/parser.ts` - 脚本解析器
   - 使用 GB2312/GBK 解码脚本文件
   - 修复中文字符编码问题

3. `packages/engine/src/character/character.ts` - 角色系统
   - 使用 GB2312/GBK 解码 NPC 配置文件
   - 修复 NPC 名称显示问题

**浏览器兼容性 / Browser Compatibility:**

| Format | Chrome | Firefox | Safari | Edge |
|--------|--------|---------|--------|------|
| MP3    | ✅     | ✅      | ✅     | ✅   |
| OGG    | ✅     | ✅      | ❌     | ✅   |
| WMA    | ❌     | ❌      | ❌     | ✅   |

## 常见问题 / FAQ

**Q: 为什么我看不到 "��Ӱ��" 这样的乱码了？**
A: 代码现在正确使用 GB2312/GBK 解码中文文件。

**Q: Why don't I see garbled text like "��Ӱ��" anymore?**
A: The code now properly decodes Chinese files using GB2312/GBK encoding.

**Q: 音乐为什么不自动播放？**
A: 浏览器安全策略要求用户交互后才能播放音频。点击游戏窗口即可开始播放。

**Q: Why doesn't music autoplay?**
A: Browser security policies require user interaction before playing audio. Click on the game window to start playback.

**Q: 我需要转换所有音乐文件吗？**
A: 如果想在 Chrome/Firefox 中听音乐，建议转换。Safari 可能支持其他格式。

**Q: Do I need to convert all music files?**
A: Recommended if you want music in Chrome/Firefox. Safari may support other formats.
