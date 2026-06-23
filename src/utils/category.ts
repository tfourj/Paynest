import { Ionicons } from "@expo/vector-icons";

export function iconFor(category: string): keyof typeof Ionicons.glyphMap {
  return ({
    None: "pricetag-outline",
    Streaming: "film",
    Music: "musical-notes",
    Software: "code-slash",
    Cloud: "cloud",
    Gaming: "game-controller",
    Fitness: "fitness",
    Finance: "wallet",
    Utilities: "flash",
    Education: "school",
    Other: "ellipse",
  }[category] ?? "ellipse") as keyof typeof Ionicons.glyphMap;
}

export function colorFor(category: string) {
  return ({
    None: "#64748B",
    Streaming: "#E50914",
    Music: "#1DB954",
    Software: "#8B5CF6",
    Cloud: "#3B82F6",
    Gaming: "#F97316",
    Fitness: "#16A34A",
    Finance: "#0891B2",
    Utilities: "#EAB308",
    Education: "#6366F1",
    Other: "#64748B",
  }[category] ?? "#64748B");
}
