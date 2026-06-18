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
 * Suggests the next target based on historical performance and target rep range.
 */
export function calculateNextTarget(
  previousSets: SetPerformance[],
  targetRange: ExerciseTarget,
  fallbackWeightIncrement: number = 2.5
): Suggestion {
  if (!previousSets || previousSets.length === 0) {
    return {
      suggestedWeight: 20, // default empty bar
      suggestedTargetReps: targetRange.minReps,
      message: "First time tracking! Set a baseline weight.",
    };
  }

  const lastSet = previousSets[previousSets.length - 1];
  const { weight, reps } = lastSet;
  const { minReps, maxReps } = targetRange;

  // Attempt to deduce the user's preferred weight increment from their history
  let weightIncrement = fallbackWeightIncrement;
  // Scan backwards to find the last time they successfully increased the weight
  for (let i = previousSets.length - 1; i > 0; i--) {
    const diff = previousSets[i].weight - previousSets[i - 1].weight;
    if (diff > 0) {
      weightIncrement = diff;
      break;
    }
  }

  // Case 1: Reached or exceeded the top of the rep range
  // Action: Increase weight, reset reps to bottom of range
  if (reps >= maxReps) {
    return {
      suggestedWeight: weight + weightIncrement,
      suggestedTargetReps: minReps,
      message: `You hit ${reps} reps! Time to increase the weight by ${weightIncrement}.`,
    };
  }

  // Case 2: Hit minimum reps but not max reps
  // Action: Keep weight same, dynamically increase target reps based on what was hit
  if (reps >= minReps && reps < maxReps) {
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

