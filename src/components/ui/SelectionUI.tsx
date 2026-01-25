/**
 * Selection UI Component - displays multiple choice options
 */
import React from "react";
import type { SelectionGuiState } from "../../engine/gui/types";

interface SelectionUIProps {
  state: SelectionGuiState;
  onSelect: (index: number) => void;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "90%",
    maxWidth: 400,
    pointerEvents: "auto",
  },
  container: {
    background: "linear-gradient(180deg, rgba(30, 40, 60, 0.98) 0%, rgba(15, 20, 35, 0.99) 100%)",
    border: "2px solid #5a7fbb",
    borderRadius: 8,
    padding: 0,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
  },
  header: {
    background: "linear-gradient(90deg, #3a5a8a 0%, #2a3a5a 100%)",
    padding: "12px 20px",
    borderBottom: "1px solid #5a7fbb",
    borderRadius: "6px 6px 0 0",
  },
  title: {
    color: "#ffd700",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center" as const,
    margin: 0,
  },
  optionList: {
    padding: "12px 16px",
  },
  option: {
    background: "linear-gradient(180deg, rgba(50, 70, 100, 0.6) 0%, rgba(30, 50, 80, 0.6) 100%)",
    border: "1px solid rgba(90, 127, 187, 0.5)",
    borderRadius: 6,
    padding: "12px 16px",
    marginBottom: 8,
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  optionSelected: {
    background: "linear-gradient(180deg, rgba(70, 100, 140, 0.8) 0%, rgba(50, 80, 120, 0.8) 100%)",
    border: "1px solid #7a9fdb",
    boxShadow: "0 0 10px rgba(100, 150, 220, 0.3)",
  },
  optionHovered: {
    background: "linear-gradient(180deg, rgba(60, 90, 130, 0.7) 0%, rgba(40, 70, 110, 0.7) 100%)",
    border: "1px solid #6a8fcb",
  },
  optionDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  optionNumber: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#4a6fa5",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: "bold",
  },
  optionText: {
    color: "#e8e8e8",
    fontSize: 14,
    flex: 1,
  },
  footer: {
    padding: "10px 16px",
    borderTop: "1px solid rgba(90, 127, 187, 0.5)",
  },
  hint: {
    color: "#8aa8d8",
    fontSize: 12,
    textAlign: "center" as const,
  },
};

export const SelectionUI: React.FC<SelectionUIProps> = ({ state, onSelect }) => {
  if (!state.isVisible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.header}>
          <p style={styles.title}>请选择</p>
        </div>
        <div style={styles.optionList}>
          {state.options.map((option, index) => {
            const isSelected = index === state.selectedIndex;
            const isHovered = index === state.hoveredIndex;
            const isDisabled = !option.enabled;

            return (
              <div
                key={index}
                style={{
                  ...styles.option,
                  ...(isSelected ? styles.optionSelected : {}),
                  ...(isHovered && !isSelected ? styles.optionHovered : {}),
                  ...(isDisabled ? styles.optionDisabled : {}),
                }}
                onClick={() => !isDisabled && onSelect(index)}
                onMouseEnter={() => {
                  // Could add hover state update here
                }}
              >
                <span style={styles.optionNumber}>{index + 1}</span>
                <span style={styles.optionText}>{option.text}</span>
              </div>
            );
          })}
        </div>
        <div style={styles.footer}>
          <p style={styles.hint}>按数字键或点击选择 | ↑↓选择 空格确认</p>
        </div>
      </div>
    </div>
  );
};
