export interface SetPerformance {
  weight: number;
  reps: number;
  targetWeight: number;
  targetReps: number;
}

export interface ExerciseTarget {
  minReps: number;
  maxReps: number;
}

export interface Suggestion {
  suggestedWeight: number;
  suggestedTargetReps: number;
  message: string;
}

/**
 * Core Progressive Overload Engine
 * Suggests the next target based on the previous performance and target rep range.
 */
export function calculateNextTarget(
  previousSet: SetPerformance | null,
  targetRange: ExerciseTarget,
  weightIncrement: number = 2.5 // default 2.5 kg or lbs
): Suggestion {
  // If no previous set, start with a baseline (this would ideally be user input, but we default to something)
  if (!previousSet) {
    return {
      suggestedWeight: 20, // default empty bar
      suggestedTargetReps: targetRange.minReps,
      message: "First time tracking! Set a baseline weight.",
    };
  }

  const { weight, reps } = previousSet;
  const { minReps, maxReps } = targetRange;

  // Case 1: Reached or exceeded the top of the rep range
  // Action: Increase weight, reset reps to bottom of range
  if (reps >= maxReps) {
    const extraReps = Math.max(0, reps - maxReps);
    // Base increment + extra increments for every 2 extra reps
    const multiplier = 1 + Math.floor(extraReps / 2);
    const totalIncrement = weightIncrement * multiplier;
    return {
      suggestedWeight: weight + totalIncrement,
      suggestedTargetReps: minReps,
      message: `You hit ${reps} reps! Time to increase the weight by ${totalIncrement}.`,
    };
  }

  // Case 2: Hit minimum reps but not max reps
  // Action: Keep weight same, dynamically increase target reps based on what was hit
  if (reps >= minReps && reps < maxReps) {
    // If they were aiming for 8 and hit 9, next target is 10.
    // We add 1 to whatever they ACTUALLY hit, capped at maxReps.
    const newTargetReps = Math.min(maxReps, reps + 1);
    return {
      suggestedWeight: weight,
      suggestedTargetReps: newTargetReps,
      message: `Good job hitting the target range. Try for ${newTargetReps} reps this time!`,
    };
  }

  // Case 3: Failed to hit minimum reps
  // Action: Keep weight same, keep target reps at minimum
  return {
    suggestedWeight: weight,
    suggestedTargetReps: minReps,
    message: `Didn't hit the minimum reps last time. Let's aim for ${minReps} reps again with the same weight.`,
  };
}

