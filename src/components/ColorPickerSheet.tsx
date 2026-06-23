import { Modal, Pressable, Text, View } from "react-native";
import ColorPicker, { HueCircular, Panel1, Preview, Swatches } from "reanimated-color-picker";

import { styles } from "../styles";
import type { Colors } from "../theme";

const neutralColors = [
  "#111827",
  "#374151",
  "#6B7280",
  "#9CA3AF",
  "#D1D5DB",
  "#E5E7EB",
  "#F3F4F6",
  "#FFFFFF",
];

type ColorPickerSheetProps = {
  c: Colors;
  visible: boolean;
  title: string;
  value: string;
  presets: string[];
  onClose: () => void;
  onChangeColor: (color: string) => void;
  onDone?: () => void;
};

export function ColorPickerSheet({
  c,
  visible,
  title,
  value,
  presets,
  onClose,
  onChangeColor,
  onDone,
}: ColorPickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose} />
      <View style={[styles.colorPickerSheet, { backgroundColor: c.background }]}>
        <View style={styles.dateSheetHandle} />
        <View style={styles.dateSheetHeader}>
          <View>
            <Text style={[styles.dateLabel, { color: c.textMuted }]}>COLOR</Text>
            <Text style={[styles.payDateTitle, { color: c.text }]}>{title}</Text>
          </View>
          <Pressable onPress={onDone ?? onClose} style={styles.doneButton}>
            <Text style={[styles.doneButtonText, { color: c.primary }]}>Done</Text>
          </Pressable>
        </View>

        <ColorPicker
          value={value}
          onChangeJS={(color) => onChangeColor(color.hex)}
          thumbShape="ring"
          thumbSize={26}
          sliderThickness={22}
          style={styles.reanimatedColorPicker}
        >
          <View style={styles.colorPickerPreviewRow}>
            <Preview
              colorFormat="hex"
              style={[styles.colorPickerPreview, { borderColor: c.border }]}
              textStyle={[styles.colorPickerValue, { color: c.text }]}
            />
          </View>
          <View style={styles.reanimatedPickerBody}>
            <Panel1 style={styles.colorPickerPanel} />
            <HueCircular style={styles.colorPickerHueCircular} />
          </View>
          <View style={styles.colorPresetSection}>
            <Text style={[styles.colorPickerLabel, { color: c.textMuted }]}>PRESETS</Text>
            <Swatches
              colors={[...presets, ...neutralColors]}
              style={styles.reanimatedSwatches}
              swatchStyle={styles.reanimatedSwatch}
            />
          </View>
        </ColorPicker>
      </View>
    </Modal>
  );
}
