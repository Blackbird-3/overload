"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { APPWRITE_CONFIG } from "@/lib/appwrite";
import { offlineSync } from "@/lib/offlineSync";
import { ID, Query } from "appwrite";
import { Loader2, Plus, Dumbbell, Save, CheckCircle2, ChevronRight, Info, X, Clock, PlayCircle } from "lucide-react";
import { calculateNextTarget, Suggestion, SetPerformance, ExerciseTarget } from "@/lib/overloadEngine";
import { motion, AnimatePresence } from "framer-motion";

// Helper for Web Audio API "ding" sound
function playDing() {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime); // High pitch ding
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio API failed", e);
  }
}

// Helper to format time
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function WorkoutTrackingPage() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<any[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<any | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState({ weight: "", reps: "" });
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(1);
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  
  // Rest Timer State
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const notifiedRef = useRef(false);
  
  // Previous drop sets display
  const [previousDropSets, setPreviousDropSets] = useState<any[]>([]);

  // Duration ticking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (workoutStartTime && selectedRoutine) {
      interval = setInterval(() => {
        setWorkoutDuration(Math.floor((Date.now() - workoutStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workoutStartTime, selectedRoutine]);

  // Rest timer ticking (absolute time)
  useEffect(() => {
    if (!restEndTime) {
      setRestRemaining(null);
      return;
    }
    
    const interval = setInterval(() => {
      const remaining = Math.ceil((restEndTime - Date.now()) / 1000);
      if (remaining > 0) {
        setRestRemaining(remaining);
      } else {
        setRestRemaining(0);
        setRestEndTime(null);
        
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          playDing();
          if (localStorage.getItem("notifications_enabled") === "true") {
            try {
              new Notification("Rest Complete!", { body: "Time for your next set." });
            } catch (e) {}
          }
        }
      }
    }, 500); // Check twice a second for smoothness
    
    return () => clearInterval(interval);
  }, [restEndTime]);

  useEffect(() => {
    async function init() {
      if (!user) return;
      try {
        const res = await offlineSync.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.routinesCollectionId,
          [Query.equal("userId", user.$id), Query.limit(100)]
        );
        setRoutines(res.documents);
        
        // Removed automatic document creation here to prevent empty workouts
        
        // Check for active workout in localStorage
        const savedStateStr = localStorage.getItem(`activeWorkout_${user.$id}`);
        if (savedStateStr) {
          try {
            const savedState = JSON.parse(savedStateStr);
            setSelectedRoutine(savedState.selectedRoutine);
            setActiveExerciseIndex(savedState.activeExerciseIndex);
            setCurrentSetIndex(savedState.currentSetIndex);
            setCompletedExercises(savedState.completedExercises);
            setWorkoutId(savedState.workoutId);
            setWorkoutStartTime(savedState.workoutStartTime);
          } catch (e) {
            console.error("Failed to parse active workout state", e);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user]);

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    if (user && selectedRoutine && workoutId) {
      const workoutState = {
        selectedRoutine,
        activeExerciseIndex,
        currentSetIndex,
        completedExercises,
        workoutId,
        workoutStartTime
      };
      localStorage.setItem(`activeWorkout_${user.$id}`, JSON.stringify(workoutState));
    }
  }, [user, selectedRoutine, activeExerciseIndex, currentSetIndex, completedExercises, workoutId, workoutStartTime]);

  // Analyze previous set when exercise or set index changes
  useEffect(() => {
    async function analyzePreviousPerformance() {
      if (!user || !selectedRoutine) return;
      const exercise = JSON.parse(selectedRoutine.exercises[activeExerciseIndex]);
      
      try {
        // 1. Find the absolute most recent set to determine the last workoutId
        const recentRes = await offlineSync.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.setsCollectionId,
          [
            Query.equal("userId", user.$id),
            Query.equal("exerciseName", exercise.name),
            Query.orderDesc("$createdAt"),
            Query.limit(1)
          ]
        );

        let prevSet: SetPerformance | null = null;
        if (recentRes.documents.length > 0) {
          const lastWorkoutId = recentRes.documents[0].workoutId;
          
          // 2. Fetch all sets for this exercise from that specific past workout
          const workoutSetsRes = await offlineSync.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.setsCollectionId,
            [
              Query.equal("userId", user.$id),
              Query.equal("workoutId", lastWorkoutId),
              Query.equal("exerciseName", exercise.name),
              Query.orderAsc("$createdAt")
            ]
          );

          const sets = workoutSetsRes.documents;
          const dropSets = sets.filter((s: any) => s.isDropSet);
          setPreviousDropSets(dropSets);
          
          const normalSets = sets.filter((s: any) => !s.isDropSet);
          
          // Match the current set number. If they are doing more sets today than last time, fallback to the last logged set.
          const matchedDoc = normalSets[currentSetIndex - 1] || normalSets[normalSets.length - 1];

          if (matchedDoc) {
            prevSet = {
              weight: matchedDoc.weight,
              reps: matchedDoc.reps,
              targetWeight: matchedDoc.targetWeight || matchedDoc.weight,
              targetReps: matchedDoc.targetReps || exercise.minReps,
            };
          }
        } else {
          setPreviousDropSets([]);
        }

        const targetRange: ExerciseTarget = { minReps: exercise.minReps, maxReps: exercise.maxReps };
        const suggestion = calculateNextTarget(prevSet, targetRange);
        
        setSuggestion(suggestion);
        setCurrentSet({ 
          weight: suggestion.suggestedWeight.toString(), 
          reps: suggestion.suggestedTargetReps.toString() 
        });

      } catch (error) {
        console.error("Failed to fetch previous sets", error);
      }
    }
    analyzePreviousPerformance();
  }, [activeExerciseIndex, currentSetIndex, selectedRoutine, user]);

  const logSet = async (isDropSet = false) => {
    if (!user || !workoutId || !selectedRoutine || !currentSet.weight || !currentSet.reps) return;
    setSaving(true);
    const exercise = JSON.parse(selectedRoutine.exercises[activeExerciseIndex]);
    const targetSets = exercise.targetSets || 3;
    
    try {
      await offlineSync.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.setsCollectionId,
        ID.unique(),
        {
          userId: user.$id,
          workoutId: workoutId,
          exerciseName: exercise.name,
          weight: parseFloat(currentSet.weight),
          reps: parseInt(currentSet.reps),
          targetWeight: suggestion?.suggestedWeight || parseFloat(currentSet.weight),
          targetReps: suggestion?.suggestedTargetReps || parseInt(currentSet.reps),
          isDropSet
        }
      );
      
      // Only advance the main set index if it's NOT a drop set
      if (!isDropSet) {
        notifiedRef.current = false;
        setRestEndTime(Date.now() + 120 * 1000);
        setCurrentSetIndex(curr => curr + 1);
        setCurrentSet(curr => ({ 
          ...curr, 
          reps: suggestion?.suggestedTargetReps.toString() || "" 
        }));
      } else {
        // For drop set, we don't start a rest timer, we just clear for the next immediate set
        setCurrentSet({ weight: "", reps: "" });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const advanceExercise = () => {
    if (!selectedRoutine) return;
    const exercise = JSON.parse(selectedRoutine.exercises[activeExerciseIndex]);
    setCompletedExercises([...completedExercises, exercise.name]);
    setRestEndTime(null);
    setRestRemaining(null);
    
    if (activeExerciseIndex < selectedRoutine.exercises.length - 1) {
      setActiveExerciseIndex(curr => curr + 1);
      setCurrentSetIndex(1);
    } else {
      finishWorkout();
    }
  };

  const finishWorkout = async () => {
    // Update workout duration
    const duration = workoutStartTime ? Math.floor((Date.now() - workoutStartTime) / 1000) : 0;
    try {
      await offlineSync.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.workoutsCollectionId,
        workoutId!,
        { duration }
      );
    } catch (e) { console.error("Failed to save duration", e) }

    alert("Workout Complete! Great job.");
    setSelectedRoutine(null);
    setWorkoutId(null);
    setWorkoutStartTime(null);
    if (user) {
      localStorage.removeItem(`activeWorkout_${user.$id}`);
    }
    window.location.href = "/dashboard";
  };

  const cancelWorkout = async () => {
    if (!confirm("Are you sure you want to cancel this workout? Progress will be lost.")) return;
    try {
      // Offline queue will handle this
      if (workoutId) {
        await offlineSync.deleteDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.workoutsCollectionId,
          workoutId
        );
      }
    } catch(e) {}
    
    setSelectedRoutine(null);
    setWorkoutId(null);
    setWorkoutStartTime(null);
    if (user) {
      localStorage.removeItem(`activeWorkout_${user.$id}`);
    }
    window.location.href = "/dashboard";
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500 h-8 w-8" /></div>;

  const startWorkout = async (r: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const workout = await offlineSync.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.workoutsCollectionId,
        ID.unique(),
        { userId: user.$id, date: new Date().toISOString(), routineId: r.$id }
      );
      setWorkoutId(workout.$id);
      setSelectedRoutine(r);
      setWorkoutStartTime(Date.now());
    } catch (error) {
      console.error("Failed to start workout", error);
      alert("Failed to start workout. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedRoutine) {
    return (
      <div className="space-y-6 text-white pb-20">
        <h1 className="text-2xl font-bold tracking-tight">Select Routine</h1>
        <div className="grid grid-cols-1 gap-4">
          {routines.map(r => (
            <button
              key={r.$id}
              onClick={() => startWorkout(r)}
              className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/20 text-blue-400 p-3 rounded-xl"><Dumbbell className="h-6 w-6" /></div>
                <div>
                  <h3 className="text-xl font-semibold">{r.name}</h3>
                  <p className="text-sm text-gray-400">{r.exercises.length} exercises</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          ))}
          {routines.length === 0 && (
             <p className="text-gray-400">No routines found. Create one first!</p>
          )}
        </div>
      </div>
    );
  }

  const activeExercise = JSON.parse(selectedRoutine.exercises[activeExerciseIndex]);

  return (
    <div className="space-y-6 text-white pb-20 relative">
      <header className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="text-sm text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded">
              {formatTime(workoutDuration)}
            </div>
            <div className="text-sm text-blue-400 font-medium">
              Exercise {activeExerciseIndex + 1} of {selectedRoutine.exercises.length}
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{activeExercise.name}</h1>
          <p className="text-gray-400">Target Range: {activeExercise.minReps}-{activeExercise.maxReps} reps</p>
        </div>
        <button 
          onClick={cancelWorkout}
          className="text-red-400 hover:text-red-300 bg-red-500/10 p-2 rounded-lg transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      {/* Rest Timer Banner */}
      <AnimatePresence>
        {restRemaining !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-600 rounded-2xl p-4 flex items-center justify-between shadow-lg overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-blue-200" />
              <div>
                <div className="text-sm text-blue-200">Rest Timer</div>
                <div className="text-2xl font-bold font-mono">{formatTime(restRemaining)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRestEndTime(Date.now() + ((restRemaining || 0) + 30) * 1000)} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors">+30s</button>
              <button onClick={() => setRestEndTime(Date.now() + Math.max(0, (restRemaining || 0) - 30) * 1000)} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors">-30s</button>
              <button onClick={() => setRestEndTime(null)} className="bg-black/30 hover:bg-black/50 px-3 py-1 rounded text-sm font-medium transition-colors">Skip</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Suggest Engine Output */}
      <AnimatePresence mode="wait">
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-blue-100">Smart Suggestion</h3>
                <p className="text-sm text-blue-300/80 mt-1">{suggestion.message}</p>
                <div className="mt-3 flex gap-4">
                  <div className="bg-black/40 rounded-lg px-3 py-2 text-center flex-1 border border-white/5">
                    <span className="block text-xs text-gray-400 mb-1">Target Weight</span>
                    <span className="font-bold text-lg">{suggestion.suggestedWeight} kg</span>
                  </div>
                  <div className="bg-black/40 rounded-lg px-3 py-2 text-center flex-1 border border-white/5">
                    <span className="block text-xs text-gray-400 mb-1">Target Reps</span>
                    <span className="font-bold text-lg">{suggestion.suggestedTargetReps}</span>
                  </div>
                </div>
                
                {previousDropSets.length > 0 && (
                  <div className="mt-3 text-xs text-purple-300/80 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                    <strong className="block text-purple-300">Last workout's drop sets:</strong>
                    {previousDropSets.map((ds, i) => (
                      <div key={i}>• {ds.weight}kg × {ds.reps} reps</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logging Form */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <h2 className="text-lg font-semibold mb-4">Log Set</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Weight (kg)</label>
            <input
              type="number"
              value={currentSet.weight}
              onChange={(e) => setCurrentSet({ ...currentSet, weight: e.target.value })}
              className="w-full text-center text-3xl font-bold bg-black/50 border border-white/10 rounded-xl py-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Reps</label>
            <input
              type="number"
              value={currentSet.reps}
              onChange={(e) => setCurrentSet({ ...currentSet, reps: e.target.value })}
              className="w-full text-center text-3xl font-bold bg-black/50 border border-white/10 rounded-xl py-4 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          {currentSetIndex <= (activeExercise.targetSets || 3) ? (
            <button
              onClick={() => logSet(false)}
              disabled={saving || !currentSet.weight || !currentSet.reps}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-semibold hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin h-6 w-6" /> : <><CheckCircle2 className="h-6 w-6" /> Complete Set {currentSetIndex}</>}
            </button>
          ) : (
            <button
              onClick={advanceExercise}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-lg font-semibold hover:bg-green-500 active:scale-95 transition-all"
            >
              Next Exercise <ChevronRight className="h-6 w-6" />
            </button>
          )}
          
          <div className="flex gap-3">
            {currentSetIndex > (activeExercise.targetSets || 3) && (
              <button
                onClick={() => logSet(false)}
                disabled={saving || !currentSet.weight || !currentSet.reps}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600/30 border border-blue-500/50 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-600/40 active:scale-95 transition-all disabled:opacity-50"
              >
                Log Extra Set
              </button>
            )}
            <button
              onClick={() => logSet(true)}
              disabled={saving || !currentSet.weight || !currentSet.reps}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-600/30 border border-purple-500/50 py-3 text-sm font-semibold text-purple-200 hover:bg-purple-600/40 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4 text-purple-400" /> : 'Log Drop Set'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {selectedRoutine.exercises.map((_: string, idx: number) => (
          <div 
            key={idx} 
            className={`h-2 rounded-full transition-all ${idx === activeExerciseIndex ? 'w-8 bg-blue-500' : idx < activeExerciseIndex ? 'w-2 bg-green-500' : 'w-2 bg-gray-600'}`}
          />
        ))}
      </div>
    </div>
  );
}
