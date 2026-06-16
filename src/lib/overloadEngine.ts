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
  if (previousSets.length >= 2) {
    const prev2 = previousSets[previousSets.length - 2];
    const prev1 = previousSets[previousSets.length - 1];
    const diff = prev1.weight - prev2.weight;
    
    // If they successfully increased the weight previously, assume that's their equipment's increment step
    if (diff > 0) {
      weightIncrement = diff;
    } else if (previousSets.length >= 3) {
      const prev3 = previousSets[previousSets.length - 3];
      const diff2 = prev2.weight - prev3.weight;
      if (diff2 > 0) {
        weightIncrement = diff2;
      }
    }
  }

  // Case 1: Reached or exceeded the top of the rep range
  // Action: Increase weight, reset reps to bottom of range
  if (reps >= maxReps) {
    const extraReps = Math.max(0, reps - maxReps);
    // Base increment + extra increments for every 2 extra reps (using deduced increment)
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

