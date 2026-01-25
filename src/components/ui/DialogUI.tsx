/**
 * Dialog UI Component - displays NPC dialogue
 */
import React, { useEffect, useState, useMemo } from "react";
import type { DialogGuiState } from "../../engine/gui/types";

interface DialogUIProps {
  state: DialogGuiState;
  onClose: () => void;
}

// Color mapping for <color=X> tags
const colorMap: Record<string, string> = {
  red: "#ff4444",
  Red: "#ff4444",
  RED: "#ff4444",
  blue: "#4488ff",
  Blue: "#4488ff",
  BLUE: "#4488ff",
  green: "#44ff44",
  Green: "#44ff44",
  GREEN: "#44ff44",
  yellow: "#ffff44",
  Yellow: "#ffff44",
  YELLOW: "#ffff44",
  black: "#e8e8e8", // In dark UI, black text shows as light
  Black: "#e8e8e8",
  BLACK: "#e8e8e8",
  white: "#ffffff",
  White: "#ffffff",
  WHITE: "#ffffff",
  purple: "#aa44ff",
  Purple: "#aa44ff",
  orange: "#ff8844",
  Orange: "#ff8844",
};

// Parse text with <color=X> tags into segments
interface TextSegment {
  text: string;
  color: string;
}

function parseColoredText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<color=([^>]+)>/gi;
  let lastIndex = 0;
  let currentColor = "#e8e8e8"; // default color
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this tag
    if (match.index > lastIndex) {
      const segment = text.substring(lastIndex, match.index);
      if (segment) {
        segments.push({ text: segment, color: currentColor });
      }
    }
    // Update color
    currentColor = colorMap[match[1]] || match[1] || "#e8e8e8";
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), color: currentColor });
  }

  return segments;
}

// Extract speaker name from text like "杨影枫：text" or "NPC名字：text"
function extractSpeakerName(text: string): { name: string; content: string } {
  // Match pattern: name：content or name:content (Chinese or English colon)
  const match = text.match(/^([^：:]+)[：:](.+)$/s);
  if (match) {
    return { name: match[1].trim(), content: match[2].trim() };
  }
  return { name: "", content: text };
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    width: "90%",
    maxWidth: 700,
    pointerEvents: "auto",
  },
  container: {
    background: "linear-gradient(180deg, rgba(20, 30, 50, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)",
    border: "2px solid #4a6fa5",
    borderRadius: 8,
    padding: 0,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
  },
  header: {
    background: "linear-gradient(90deg, #2a4a7a 0%, #1a2a4a 100%)",
    padding: "8px 16px",
    borderBottom: "1px solid #4a6fa5",
    borderRadius: "6px 6px 0 0",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  portrait: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "#1a2a4a",
    border: "2px solid #6a8fc5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  name: {
    color: "#ffd700",
    fontSize: 16,
    fontWeight: "bold",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
  },
  content: {
    padding: 20,
    minHeight: 80,
  },
  text: {
    color: "#e8e8e8",
    fontSize: 16,
    lineHeight: 1.6,
    textShadow: "0 1px 1px rgba(0, 0, 0, 0.3)",
    margin: 0,
  },
  footer: {
    padding: "10px 16px",
    borderTop: "1px solid rgba(74, 111, 165, 0.5)",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  hint: {
    color: "#8aa8d8",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  continueIndicator: {
    animation: "blink 1s infinite",
    color: "#ffd700",
  },
};

// Portrait emoji mapping based on index
const getPortraitEmoji = (index: number): string => {
  const portraits = ["👤", "👨", "👩", "👴", "👵", "👦", "👧", "🧔", "👲", "🧙", "⚔️", "🗡️", "💎"];
  return portraits[index % portraits.length];
};

// Render text with color segments
const ColoredText: React.FC<{ text: string }> = ({ text }) => {
  const segments = useMemo(() => parseColoredText(text), [text]);

  return (
    <>
      {segments.map((segment, index) => (
        <span key={index} style={{ color: segment.color }}>
          {segment.text}
        </span>
      ))}
    </>
  );
};

export const DialogUI: React.FC<DialogUIProps> = ({ state, onClose }) => {
  const [displayedText, setDisplayedText] = useState("");

  // Parse speaker name from full text
  const { name: speakerName, content: dialogContent } = useMemo(
    () => extractSpeakerName(state.text),
    [state.text]
  );

  useEffect(() => {
    if (!state.isVisible) {
      setDisplayedText("");
      return;
    }

    // Calculate visible text based on progress (count actual characters, not tags)
    const plainText = state.text.replace(/<color=[^>]+>/gi, "");
    const targetLength = Math.floor(state.textProgress);

    // We need to map plain text progress to original text with tags
    let plainIndex = 0;
    let originalIndex = 0;
    const tagRegex = /<color=[^>]+>/gi;
    let tagMatch: RegExpExecArray | null;
    const tagPositions: { start: number; end: number }[] = [];

    // Find all tag positions
    while ((tagMatch = tagRegex.exec(state.text)) !== null) {
      tagPositions.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
    }

    // Map target plain length to original length with tags
    let tagIdx = 0;
    while (plainIndex < targetLength && originalIndex < state.text.length) {
      // Skip any tags at current position
      while (tagIdx < tagPositions.length && originalIndex === tagPositions[tagIdx].start) {
        originalIndex = tagPositions[tagIdx].end;
        tagIdx++;
      }
      if (originalIndex < state.text.length) {
        plainIndex++;
        originalIndex++;
      }
    }

    // Include any trailing tags
    while (tagIdx < tagPositions.length && originalIndex === tagPositions[tagIdx].start) {
      originalIndex = tagPositions[tagIdx].end;
      tagIdx++;
    }

    setDisplayedText(state.text.substring(0, originalIndex));
  }, [state.text, state.textProgress, state.isVisible]);

  if (!state.isVisible) return null;

  // Use extracted speaker name or provided nameText
  const displayName = state.nameText || speakerName || "对话";

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.portrait}>{getPortraitEmoji(state.portraitIndex)}</div>
          <span style={styles.name}>{displayName}</span>
        </div>
        <div style={styles.content}>
          <p style={styles.text}>
            <ColoredText text={displayedText} />
            {!state.isComplete && <span style={styles.continueIndicator}>|</span>}
          </p>
        </div>
        <div style={styles.footer}>
          <span style={styles.hint}>
            {state.isComplete ? (
              <>
                点击继续 <span style={styles.continueIndicator}>▶</span>
              </>
            ) : (
              "点击跳过"
            )}
          </span>
        </div>
      </div>
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};
