// Measured against the unchanged 24 fps base and gaze sources. These are
// frontal pose matches, not arbitrary time offsets or newly drawn poses.
export const V7_MASCOT_POSE_SPLICE = Object.freeze({
  // Play the complete original base sequence before the recorded glance.
  baseToGazeMatchSeconds: 611 / 24,
  gazeMatchStartSeconds: 0,
  gazeToBaseMatchSeconds: 288 / 24,
  baseMatchRestartSeconds: 0,
});

export const V7_MASCOT_GAZE_INTENT_EVENT = "liquid-v7:mascot-gaze-intent";
export type V7MascotGazeDirection = "left" | "right" | "neutral";
export type V7MascotGazeIntent = Readonly<{ direction: V7MascotGazeDirection }>;

// Both holds use real frames of the original clip. The recorded route travels
// left, then right, then frontal; it is never reversed or scrubbed to a cursor.
export const V7_MASCOT_RECORDED_LOOKS = Object.freeze({
  left: 66 / 24,
  right: 126 / 24,
  maximumHoldMs: 1800,
});
