import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import * as Haptics from "expo-haptics";

// Keep motion off until the system preference is known.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function selectionFeedback() {
  // Haptics are optional; unsupported devices must still complete the action.
  void Haptics.selectionAsync().catch(() => undefined);
}
