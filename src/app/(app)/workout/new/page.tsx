"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { APPWRITE_CONFIG } from "@/lib/appwrite";
import { offlineSync } from "@/lib/offlineSync";
import { ID, Query } from "appwrite";
import { Loader2, Dumbbell, CheckCircle2, ChevronRight, Info, X, Clock, Link as LinkIcon } from "lucide-react";
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
    osc.frequency.setValueAtTime(800, ctx.currentTime);
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
  const [loading, setLoading] = useState(true);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  
  // Tracking State
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [activeExerciseIndices, setActiveExerciseIndices] = useState<number[]>([]);
  
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  
  // Rest Timer State
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const notifiedRef = useRef(false);

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
          // Fallback if the scheduled notification didn't fire or wasn't supported
          if (localStorage.getItem("notifications_enabled") === "true") {
            try {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.getNotifications().then(notifications => {
                    // Only show if we didn't already get the scheduled one
                    if (notifications.length === 0) {
                      reg.showNotification("Rest Complete!", { body: "Time for your next set.", vibrate: [200, 100, 200] });
                    }
                  });
                });
              } else {
                new Notification("Rest Complete!", { body: "Time for your next set." });
              }
            } catch (e) {}
          }
        }
      }
    }, 500);
    
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
        
        const savedStateStr = localStorage.getItem(`activeWorkout_${user.$id}`);
        if (savedStateStr) {
          try {
            const savedState = JSON.parse(savedStateStr);
            setSelectedRoutine(savedState.selectedRoutine);
            setCompletedExercises(savedState.completedExercises || []);
            setActiveExerciseIndices(savedState.activeExerciseIndices || [savedState.activeExerciseIndex || 0]);
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
        activeExerciseIndices,
        completedExercises,
        workoutId,
        workoutStartTime
      };
      localStorage.setItem(`activeWorkout_${user.$id}`, JSON.stringify(workoutState));
    }
  }, [user, selectedRoutine, activeExerciseIndices, completedExercises, workoutId, workoutStartTime]);

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
      setActiveExerciseIndices([0]);
      setCompletedExercises([]);
    } catch (error) {
      console.error("Failed to start workout", error);
      alert("Failed to start workout. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const finishWorkout = async () => {
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

  const handleExerciseComplete = (indexCompleted: number) => {
    const exercise = JSON.parse(selectedRoutine.exercises[indexCompleted]);
    const newCompleted = [...completedExercises, exercise.name];
    setCompletedExercises(newCompleted);
    
    const newActive = activeExerciseIndices.filter(i => i !== indexCompleted);
    setRestEndTime(null);
    setRestRemaining(null);
    
    if (newActive.length > 0) {
      setActiveExerciseIndices(newActive);
    } else {
      const nextIndex = selectedRoutine.exercises.findIndex((eStr: string, i: number) => {
        const e = JSON.parse(eStr);
        return !newCompleted.includes(e.name);
      });
      
      if (nextIndex !== -1) {
        setActiveExerciseIndices([nextIndex]);
      } else {
        finishWorkout();
      }
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500 h-8 w-8" /></div>;

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

  // Available exercises for supersetting (not completed and not currently active)
  const availableForSuperset = selectedRoutine.exercises
    .map((eStr: string, i: number) => ({ exercise: JSON.parse(eStr), index: i }))
    .filter((e: any) => !completedExercises.includes(e.exercise.name) && !activeExerciseIndices.includes(e.index));

  return (
    <div className="space-y-6 text-white pb-20 relative">
      <header className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="text-sm text-blue-400 font-medium bg-blue-500/10 px-2 py-0.5 rounded flex items-center gap-2">
              <Clock className="h-4 w-4" /> {formatTime(workoutDuration)}
            </div>
            <div className="text-sm text-gray-400 font-medium">
              {completedExercises.length} / {selectedRoutine.exercises.length} Complete
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Workout in Progress</h1>
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

      {/* Render active exercises */}
      <div className="space-y-6">
        {activeExerciseIndices.map(idx => (
          <ExerciseLoggerCard
            key={idx}
            exerciseIndex={idx}
            exercise={JSON.parse(selectedRoutine.exercises[idx])}
            user={user}
            workoutId={workoutId}
            onExerciseComplete={handleExerciseComplete}
            setRestEndTime={setRestEndTime}
            notifiedRef={notifiedRef}
          />
        ))}
      </div>

      {/* Superset Selector */}
      {availableForSuperset.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/10">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-3">
            <LinkIcon className="h-4 w-4" /> Superset with...
          </label>
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            onChange={(e) => {
              if (e.target.value) {
                setActiveExerciseIndices([...activeExerciseIndices, parseInt(e.target.value)]);
                e.target.value = ""; // reset dropdown
              }
            }}
            value=""
          >
            <option value="" disabled>Select an exercise to superset</option>
            {availableForSuperset.map((item: any) => (
              <option key={item.index} value={item.index} className="bg-gray-900">
                {item.exercise.name} ({item.exercise.targetSets || 3} sets)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress Dots */}
      <div className="flex justify-center gap-2 mt-12">
        {selectedRoutine.exercises.map((eStr: string, idx: number) => {
          const e = JSON.parse(eStr);
          const isComplete = completedExercises.includes(e.name);
          const isActive = activeExerciseIndices.includes(idx);
          return (
            <div 
              key={idx} 
              className={`h-2 rounded-full transition-all ${isActive ? 'w-8 bg-blue-500' : isComplete ? 'w-2 bg-green-500' : 'w-2 bg-gray-600'}`}
              title={e.name}
            />
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-component to manage state for a single exercise independently
// --------------------------------------------------------------------------
function ExerciseLoggerCard({
  exerciseIndex,
  exercise,
  user,
  workoutId,
  onExerciseComplete,
  setRestEndTime,
  notifiedRef
}: any) {
  const [currentSet, setCurrentSet] = useState({ weight: "", reps: "" });
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [currentSetIndex, setCurrentSetIndex] = useState(1);
  const [previousDropSets, setPreviousDropSets] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize set count from DB (in case of page refresh)
  useEffect(() => {
    async function initSetCount() {
      if (!workoutId) return;
      try {
        const res = await offlineSync.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.setsCollectionId,
          [
            Query.equal("workoutId", workoutId),
            Query.equal("exerciseName", exercise.name),
            Query.limit(100)
          ]
        );
        const normalSets = res.documents.filter((d: any) => !d.isDropSet);
        if (normalSets.length > 0) {
          setCurrentSetIndex(normalSets.length + 1);
        }
      } catch (e) {
        console.error("Failed to init set count", e);
      }
    }
    initSetCount();
  }, [workoutId, exercise.name]);

  // Analyze previous set when exercise or set index changes
  useEffect(() => {
    async function analyzePreviousPerformance() {
      if (!user) return;
      
      try {
        let previousSetsHistory: SetPerformance[] = [];
        
        // Fetch up to 3 recent workouts for this exercise to determine weight increment trend
        const recentRes = await offlineSync.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.setsCollectionId,
          [
            Query.equal("userId", user.$id),
            Query.equal("exerciseName", exercise.name),
            Query.orderDesc("$createdAt"),
            Query.limit(50) // fetch enough to group by workout
          ]
        );

        if (recentRes.documents.length > 0) {
          // Group sets by workoutId
          const workoutsMap = new Map<string, any[]>();
          recentRes.documents.forEach((d: any) => {
             if (d.workoutId === workoutId) return; // Skip current workout
             if (!workoutsMap.has(d.workoutId)) workoutsMap.set(d.workoutId, []);
             workoutsMap.get(d.workoutId)!.push(d);
          });
          
          // Get the last 3 unique workouts
          const uniqueWorkoutIds = Array.from(workoutsMap.keys()).slice(0, 3);
          // Reverse so oldest is first in the array
          uniqueWorkoutIds.reverse().forEach(wId => {
             const sets = workoutsMap.get(wId)!;
             // We need to order by creation ascending to match currentSetIndex
             sets.sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
             
             // Find drop sets vs normal sets just for UI consistency if needed
             if (wId === uniqueWorkoutIds[uniqueWorkoutIds.length - 1]) {
                 setPreviousDropSets(sets.filter((s: any) => s.isDropSet));
             }
             
             const normalSets = sets.filter((s: any) => !s.isDropSet);
             const matchedDoc = normalSets[currentSetIndex - 1] || normalSets[normalSets.length - 1];
             
             if (matchedDoc) {
               previousSetsHistory.push({
                 weight: matchedDoc.weight,
                 reps: matchedDoc.reps,
                 targetWeight: matchedDoc.targetWeight || matchedDoc.weight,
                 targetReps: matchedDoc.targetReps || exercise.minReps,
               });
             }
          });
        } else {
          setPreviousDropSets([]);
        }

        const targetRange: ExerciseTarget = { minReps: exercise.minReps, maxReps: exercise.maxReps };
        const suggestion = calculateNextTarget(previousSetsHistory, targetRange);
        
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
  }, [currentSetIndex, exercise.name, user, workoutId]);

  const logSet = async (isDropSet = false) => {
    if (!user || !workoutId || !currentSet.weight || !currentSet.reps) return;
    setSaving(true);
    
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
      
      if (!isDropSet) {
        notifiedRef.current = false;
        setRestEndTime(Date.now() + 120 * 1000); // Trigger global rest timer
        
        // Attempt to schedule a background notification using experimental Notification Triggers API
        if (localStorage.getItem("notifications_enabled") === "true" && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            if ('showTrigger' in Notification.prototype) {
              try {
                reg.showNotification("Rest Complete!", {
                  body: "Time for your next set.",
                  vibrate: [200, 100, 200],
                  // @ts-ignore
                  showTrigger: new (window as any).TimestampTrigger(Date.now() + 120 * 1000)
                });
              } catch(e) {}
            }
          });
        }
        setCurrentSetIndex(curr => curr + 1);
        setCurrentSet(curr => ({ 
          ...curr, 
          reps: suggestion?.suggestedTargetReps.toString() || "" 
        }));
      } else {
        setCurrentSet({ weight: "", reps: "" });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-white mb-1">{exercise.name}</h2>
        <p className="text-gray-400 text-sm">Target: {exercise.minReps}-{exercise.maxReps} reps • {exercise.targetSets || 3} Sets</p>
      </div>

      <AnimatePresence mode="wait">
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4"
          >
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-blue-300/80">{suggestion.message}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <div className="bg-black/30 rounded px-2 py-1 text-blue-200">Weight: <b>{suggestion.suggestedWeight}kg</b></div>
                  <div className="bg-black/30 rounded px-2 py-1 text-blue-200">Reps: <b>{suggestion.suggestedTargetReps}</b></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Weight (kg)</label>
          <input
            type="number"
            value={currentSet.weight}
            onChange={(e) => setCurrentSet({ ...currentSet, weight: e.target.value })}
            className="w-full text-center text-2xl font-bold bg-black/50 border border-white/10 rounded-xl py-3 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Reps</label>
          <input
            type="number"
            value={currentSet.reps}
            onChange={(e) => setCurrentSet({ ...currentSet, reps: e.target.value })}
            className="w-full text-center text-2xl font-bold bg-black/50 border border-white/10 rounded-xl py-3 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {currentSetIndex <= (exercise.targetSets || 3) ? (
          <button
            onClick={() => logSet(false)}
            disabled={saving || !currentSet.weight || !currentSet.reps}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-base font-semibold hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <><CheckCircle2 className="h-5 w-5" /> Complete Set {currentSetIndex}</>}
          </button>
        ) : (
          <button
            onClick={() => onExerciseComplete(exerciseIndex)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-base font-semibold hover:bg-green-500 active:scale-95 transition-all"
          >
            Finish Exercise <ChevronRight className="h-5 w-5" />
          </button>
        )}
        
        <div className="flex gap-3">
          {currentSetIndex > (exercise.targetSets || 3) && (
            <button
              onClick={() => logSet(false)}
              disabled={saving || !currentSet.weight || !currentSet.reps}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600/30 border border-blue-500/50 py-2.5 text-xs font-semibold text-blue-200 hover:bg-blue-600/40 active:scale-95 transition-all disabled:opacity-50"
            >
              Log Extra Set
            </button>
          )}
          <button
            onClick={() => logSet(true)}
            disabled={saving || !currentSet.weight || !currentSet.reps}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-600/30 border border-purple-500/50 py-2.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/40 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin h-4 w-4 text-purple-400" /> : 'Log Drop Set'}
          </button>
        </div>
      </div>
    </div>
  );
}
