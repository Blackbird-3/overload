"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { APPWRITE_CONFIG } from "@/lib/appwrite";
import { offlineSync } from "@/lib/offlineSync";
import { Query } from "appwrite";
import { Loader2, Calendar, Dumbbell, Clock, Trash2, Edit2, Check, X } from "lucide-react";

function formatTime(seconds?: number) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Set State
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const workoutsRes = await offlineSync.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.workoutsCollectionId,
        [Query.equal("userId", user.$id), Query.orderDesc("$createdAt"), Query.limit(5000)]
      );
      
      const setsRes = await offlineSync.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.setsCollectionId,
        [Query.equal("userId", user.$id), Query.limit(5000)]
      );

      const routinesRes = await offlineSync.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.routinesCollectionId,
        [Query.equal("userId", user.$id), Query.limit(100)]
      );
      
      setWorkouts(workoutsRes.documents);
      setSets(setsRes.documents);
      setRoutines(routinesRes.documents);
    } catch (error) {
      console.error("Failed to fetch history", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const deleteWorkout = async (workoutId: string) => {
    if (!confirm("Delete this workout and all its sets?")) return;
    try {
      // 1. Delete associated sets
      const workoutSets = sets.filter(s => s.workoutId === workoutId);
      for (const s of workoutSets) {
        await offlineSync.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.setsCollectionId, s.$id);
      }
      // 2. Delete workout
      await offlineSync.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.workoutsCollectionId, workoutId);
      
      // Update UI optimistically
      setWorkouts(curr => curr.filter(w => w.$id !== workoutId));
      setSets(curr => curr.filter(s => s.workoutId !== workoutId));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSet = async (setId: string) => {
    if (!confirm("Delete this set?")) return;
    try {
      await offlineSync.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.setsCollectionId, setId);
      setSets(curr => curr.filter(s => s.$id !== setId));
    } catch(e) { console.error(e) }
  };

  const saveSetEdit = async (setId: string) => {
    try {
      const w = parseFloat(editWeight);
      const r = parseInt(editReps);
      if (isNaN(w) || isNaN(r)) return;

      const updated = await offlineSync.updateDocument(
        APPWRITE_CONFIG.databaseId, 
        APPWRITE_CONFIG.setsCollectionId, 
        setId, 
        { weight: w, reps: r }
      );
      
      setSets(curr => curr.map(s => s.$id === setId ? { ...s, weight: w, reps: r } : s));
      setEditingSetId(null);
    } catch(e) { console.error(e) }
  };

  return (
    <div className="space-y-6 text-white pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout History</h1>
          <p className="text-sm text-gray-400 mt-1">Review your past performances</p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Refresh History"
        >
          <Loader2 className={`h-5 w-5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </header>

      {loading && workouts.length === 0 ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
      ) : (
      <div className="space-y-4">
        {workouts.map(workout => {
          const workoutSets = sets.filter(s => s.workoutId === workout.$id);
          const date = new Date(workout.$createdAt).toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric'
          });
          
          const routine = routines.find(r => r.$id === workout.routineId);
          const routineName = routine ? routine.name : "Workout";
          
          // Group sets by exercise
          const exercisesMap = new Map<string, any[]>();
          workoutSets.forEach(s => {
            if (!exercisesMap.has(s.exerciseName)) exercisesMap.set(s.exerciseName, []);
            exercisesMap.get(s.exerciseName)!.push(s);
          });

          return (
            <div key={workout.$id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{routineName}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{date}</span>
                      <span>• {new Date(workout.$createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {workout.duration && <span className="text-gray-500">• {formatTime(workout.duration)}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded-full">
                    {workoutSets.length} sets
                  </span>
                  <button onClick={() => deleteWorkout(workout.$id)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {Array.from(exercisesMap.entries()).map(([exName, exSets]) => (
                  <div key={exName} className="bg-black/30 rounded-lg p-3">
                    <h4 className="font-medium text-sm text-gray-300 flex items-center gap-2 mb-2">
                      <Dumbbell className="h-4 w-4" /> {exName}
                    </h4>
                    <div className="space-y-1">
                      {exSets.map((s, idx) => (
                        <div key={s.$id} className="flex flex-col sm:flex-row justify-between text-sm items-start sm:items-center px-2 py-2 hover:bg-white/5 rounded group transition-colors">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-gray-500 w-12 shrink-0">Set {idx + 1}</span>
                            {s.isDropSet && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 rounded uppercase font-bold shrink-0">Drop</span>}
                            
                            {editingSetId === s.$id ? (
                              <div className="flex items-center gap-1 ml-2">
                                <input type="number" value={editWeight} onChange={e => setEditWeight(e.target.value)} className="w-16 bg-black border border-white/20 rounded px-1 text-center py-0.5" />
                                <span className="text-gray-500">kg ×</span>
                                <input type="number" value={editReps} onChange={e => setEditReps(e.target.value)} className="w-12 bg-black border border-white/20 rounded px-1 text-center py-0.5" />
                              </div>
                            ) : (
                              <span className="font-medium ml-2">{s.weight} kg × {s.reps}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                            {editingSetId === s.$id ? (
                              <div className="flex gap-1">
                                <button onClick={() => saveSetEdit(s.$id)} className="text-green-400 hover:bg-green-400/20 p-1 rounded"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setEditingSetId(null)} className="text-gray-400 hover:bg-gray-400/20 p-1 rounded"><X className="h-4 w-4" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-24 text-right hidden sm:block">
                                  {s.reps >= s.targetReps ? (
                                    <span className="text-green-400">Target Hit</span>
                                  ) : (
                                    <span>Missed Target</span>
                                  )}
                                </span>
                                <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingSetId(s.$id); setEditWeight(s.weight.toString()); setEditReps(s.reps.toString()); }} className="text-gray-400 hover:text-white p-1">
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => deleteSet(s.$id)} className="text-gray-400 hover:text-red-400 p-1 ml-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {workoutSets.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No sets recorded for this workout.</p>
                )}
              </div>
            </div>
          );
        })}
        
        {workouts.length === 0 && (
          <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl">
            No history found. Complete a workout to see it here.
          </div>
        )}
      </div>
      )}
    </div>
  );
}
