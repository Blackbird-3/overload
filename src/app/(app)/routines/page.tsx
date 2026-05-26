"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { APPWRITE_CONFIG } from "@/lib/appwrite";
import { offlineSync } from "@/lib/offlineSync";
import { ID, Query } from "appwrite";
import { Plus, Dumbbell, Trash2, Loader2, Save } from "lucide-react";

interface Exercise {
  name: string;
  minReps: number;
  maxReps: number;
  targetSets: number;
}

interface Routine {
  $id: string;
  name: string;
  exercises: string[]; // JSON strings of Exercise
}

export default function RoutinesPage() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newExercises, setNewExercises] = useState<Exercise[]>([{ name: "", minReps: 8, maxReps: 12, targetSets: 3 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoutines();
  }, [user]);

  const fetchRoutines = async () => {
    if (!user) return;
    try {
      const response = await offlineSync.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.routinesCollectionId,
        [Query.equal("userId", user.$id), Query.limit(100)]
      );
      setRoutines(response.documents as unknown as Routine[]);
    } catch (error) {
      console.error("Failed to fetch routines", error);
    } finally {
      setLoading(false);
    }
  };

  const addExerciseField = () => {
    setNewExercises([...newExercises, { name: "", minReps: 8, maxReps: 12, targetSets: 3 }]);
  };

  const updateExercise = (index: number, field: keyof Exercise, value: string | number) => {
    const updated = [...newExercises];
    updated[index] = { ...updated[index], [field]: value };
    setNewExercises(updated);
  };

  const removeExercise = (index: number) => {
    setNewExercises(newExercises.filter((_, i) => i !== index));
  };

  const saveRoutine = async () => {
    if (!user) return;
    if (!newRoutineName.trim()) {
      alert("Please enter a routine name.");
      return;
    }
    if (newExercises.some(e => !e.name.trim())) {
      alert("Please ensure all exercises have a name.");
      return;
    }
    setSaving(true);
    try {
      const exercisesJson = newExercises.map(e => JSON.stringify(e));
      
      if (editingRoutineId) {
        await offlineSync.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.routinesCollectionId,
          editingRoutineId,
          {
            name: newRoutineName,
            exercises: exercisesJson,
          }
        );
        // Optimistic UI update to prevent Appwrite index delay from hiding the routine
        setRoutines(curr => curr.map(r => r.$id === editingRoutineId ? { ...r, name: newRoutineName, exercises: exercisesJson } : r));
      } else {
        const res = await offlineSync.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.routinesCollectionId,
          ID.unique(),
          {
            userId: user.$id,
            name: newRoutineName,
            exercises: exercisesJson,
          }
        );
        // Optimistic UI update
        setRoutines(curr => [...curr, { $id: res.$id, name: newRoutineName, exercises: exercisesJson }] as unknown as Routine[]);
      }
      
      resetForm();
    } catch (error) {
      console.error("Failed to save routine", error);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingRoutineId(null);
    setNewRoutineName("");
    setNewExercises([{ name: "", minReps: 8, maxReps: 12, targetSets: 3 }]);
  };

  const startEditing = (routine: Routine) => {
    const parsedExercises = routine.exercises.map(e => JSON.parse(e));
    // Ensure older routines without targetSets get a default of 3
    const migratedExercises = parsedExercises.map((e: any) => ({
      ...e,
      targetSets: e.targetSets || 3
    }));
    
    setNewRoutineName(routine.name);
    setNewExercises(migratedExercises);
    setEditingRoutineId(routine.$id);
    setIsCreating(true);
  };

  const deleteRoutine = async (id: string) => {
    if (!confirm("Delete this routine?")) return;
    try {
      await offlineSync.deleteDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.routinesCollectionId,
        id
      );
      // Optimistic UI update
      setRoutines(curr => curr.filter(r => r.$id !== id));
    } catch (error) {
      console.error("Failed to delete routine", error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-6 text-white pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout Routines</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your training templates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRoutines}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh Routines"
          >
            <Loader2 className={`h-5 w-5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Routine
            </button>
          )}
        </div>
      </header>

      {isCreating && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <h2 className="text-xl font-semibold mb-4">{editingRoutineId ? "Edit Routine" : "Create Routine"}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Routine Name</label>
              <input
                type="text"
                value={newRoutineName}
                onChange={(e) => setNewRoutineName(e.target.value)}
                placeholder="e.g., Push Day, Full Body"
                className="w-full rounded-lg border-0 bg-black/50 py-2 px-3 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-3 mt-4">
              <label className="block text-sm font-medium text-gray-400">Exercises & Rep Ranges</label>
              {newExercises.map((exercise, index) => (
                <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-black/30 p-3 rounded-lg border border-white/5">
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={(e) => updateExercise(index, "name", e.target.value)}
                    placeholder="Exercise name"
                    className="flex-1 min-w-[150px] rounded-md border-0 bg-transparent py-1.5 px-2 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      value={exercise.targetSets}
                      onChange={(e) => updateExercise(index, "targetSets", parseInt(e.target.value) || 0)}
                      className="w-14 rounded-md border-0 bg-transparent py-1.5 px-2 text-center text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500 mr-2">sets</span>
                    <input
                      type="number"
                      value={exercise.minReps}
                      onChange={(e) => updateExercise(index, "minReps", parseInt(e.target.value) || 0)}
                      className="w-14 rounded-md border-0 bg-transparent py-1.5 px-2 text-center text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="number"
                      value={exercise.maxReps}
                      onChange={(e) => updateExercise(index, "maxReps", parseInt(e.target.value) || 0)}
                      className="w-14 rounded-md border-0 bg-transparent py-1.5 px-2 text-center text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-500 ml-1">reps</span>
                  </div>
                  <button
                    onClick={() => removeExercise(index)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addExerciseField}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-2"
              >
                <Plus className="h-4 w-4" /> Add Exercise
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={saveRoutine}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> Save Routine</>}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {routines.map((routine) => {
          const parsedExercises: Exercise[] = routine.exercises.map(e => JSON.parse(e));
          return (
            <div key={routine.$id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md relative group hover:border-white/20 transition-all">
              <div className="absolute top-4 right-4 md:opacity-0 md:group-hover:opacity-100 transition-all flex gap-3">
                <button
                  onClick={() => startEditing(routine)}
                  className="text-gray-500 hover:text-blue-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button
                  onClick={() => deleteRoutine(routine.$id)}
                  className="text-gray-500 hover:text-red-500"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold">{routine.name}</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-300">
                {parsedExercises.map((ex, i) => (
                  <li key={i} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-md">
                    <span>{ex.name}</span>
                    <span className="text-gray-500 bg-black/40 px-2 py-1 rounded text-xs">{ex.targetSets || 3} sets × {ex.minReps}-{ex.maxReps} reps</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {routines.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl">
            No routines yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
