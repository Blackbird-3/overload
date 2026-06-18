"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNextTarget = calculateNextTarget;
/**
 * Core Progressive Overload Engine
 * Suggests the next target based on historical performance and target rep range.
 */
function calculateNextTarget(previousSets, targetRange, fallbackWeightIncrement) {
    if (fallbackWeightIncrement === void 0) { fallbackWeightIncrement = 2.5; }
    if (!previousSets || previousSets.length === 0) {
        return {
            suggestedWeight: 20, // default empty bar
            suggestedTargetReps: targetRange.minReps,
            message: "First time tracking! Set a baseline weight.",
        };
    }
    var lastSet = previousSets[previousSets.length - 1];
    var weight = lastSet.weight, reps = lastSet.reps;
    var minReps = targetRange.minReps, maxReps = targetRange.maxReps;
    // Attempt to deduce the user's preferred weight increment from their history
    var weightIncrement = fallbackWeightIncrement;
    // Scan backwards to find the last time they successfully increased the weight
    for (var i = previousSets.length - 1; i > 0; i--) {
        var diff = previousSets[i].weight - previousSets[i - 1].weight;
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
            message: "You hit ".concat(reps, " reps! Time to increase the weight by ").concat(weightIncrement, "."),
        };
    }
    // Case 2: Hit minimum reps but not max reps
    // Action: Keep weight same, dynamically increase target reps based on what was hit
    if (reps >= minReps && reps < maxReps) {
        var newTargetReps = Math.min(maxReps, reps + 1);
        return {
            suggestedWeight: weight,
            suggestedTargetReps: newTargetReps,
            message: "Good job hitting the target range. Try for ".concat(newTargetReps, " reps this time!"),
        };
    }
    // Case 3: Failed to hit minimum reps
    // Action: Keep weight same, keep target reps at minimum
    return {
        suggestedWeight: weight,
        suggestedTargetReps: minReps,
        message: "Didn't hit the minimum reps last time. Let's aim for ".concat(minReps, " reps again with the same weight."),
    };
}
