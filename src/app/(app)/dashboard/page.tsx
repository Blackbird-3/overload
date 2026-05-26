"use client";

import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Activity, Dumbbell, Flame, Plus, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { APPWRITE_CONFIG } from "@/lib/appwrite";
import { offlineSync } from "@/lib/offlineSync";
import { Query } from "appwrite";

function formatTime(seconds?: number) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalWorkouts: 0, activeStreak: 0, totalVolume: 0 });
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      try {
        const [workoutsRes, setsRes, routinesRes] = await Promise.all([
          offlineSync.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.workoutsCollectionId,
            [Query.equal("userId", user.$id), Query.orderDesc("$createdAt"), Query.limit(5000)]
          ),
          offlineSync.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.setsCollectionId,
            [Query.equal("userId", user.$id), Query.limit(5000)]
          ),
          offlineSync.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.routinesCollectionId,
            [Query.equal("userId", user.$id), Query.limit(100)]
          )
        ]);

        const workouts = workoutsRes.documents;
        const sets = setsRes.documents;
        setRoutines(routinesRes.documents);
        
        // 1. Calculate Active Streak
        let streak = 0;
        const workoutDates = new Set(workouts.map((w: any) => new Date(w.$createdAt).toLocaleDateString()));
        const todayStr = new Date().toLocaleDateString();
        
        // If they worked out today, streak starts at 1. If not, maybe they worked out yesterday.
        let checkDate = new Date();
        if (!workoutDates.has(todayStr)) {
          // Check if they worked out yesterday to keep streak alive
          checkDate.setDate(checkDate.getDate() - 1);
          if (!workoutDates.has(checkDate.toLocaleDateString())) {
            streak = 0; // Missed yesterday too, streak is dead.
          } else {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        } else {
          streak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
        }

        // Keep counting backwards
        if (streak > 0) {
          while (workoutDates.has(checkDate.toLocaleDateString())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }

        // 2. Calculate Total Volume (Last 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentSets = sets.filter((s: any) => new Date(s.$createdAt).getTime() >= sevenDaysAgo && !s.isDropSet);
        const volume = recentSets.reduce((acc: number, s: any) => acc + ((s.weight || 0) * (s.reps || 0)), 0);

        setStats({
          totalWorkouts: workouts.length,
          activeStreak: streak,
          totalVolume: volume,
        });

        // 3. Recent Activity (Last 3 workouts)
        setRecentWorkouts(workouts.slice(0, 3));
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user]);

  return (
    <div className="space-y-8 pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Welcome back, {user?.name?.split(" ")[0] || "Athlete"}
        </h1>
        <p className="text-gray-400 mt-2">Ready to crush your goals today?</p>
      </header>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          href="/workout/new"
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-blue-600 px-8 py-6 text-lg font-semibold text-white shadow-lg transition-all hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-95"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 animate-shimmer" />
          <Plus className="h-6 w-6" />
          Start New Workout
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Flame className="h-5 w-5" />
            <h3 className="font-medium text-sm">Active Streak</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {loading ? "-" : stats.activeStreak}
          </p>
          <p className="text-xs text-gray-400 mt-1">Days</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Activity className="h-5 w-5" />
            <h3 className="font-medium text-sm">Workouts</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {loading ? "-" : stats.totalWorkouts}
          </p>
          <p className="text-xs text-gray-400 mt-1">Completed</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="col-span-2 sm:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Dumbbell className="h-5 w-5" />
            <h3 className="font-medium text-sm">7-Day Volume</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {loading ? "-" : stats.totalVolume.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">kg lifted</p>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
          <Link href="/history" className="text-sm text-blue-400 hover:text-blue-300">View All</Link>
        </div>
        
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 text-center text-gray-400">
              Loading activity...
            </div>
          ) : recentWorkouts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 text-center text-gray-400">
              No recent workouts found. Time to get lifting!
            </div>
          ) : (
            recentWorkouts.map(workout => {
              const routine = routines.find(r => r.$id === workout.routineId);
              const routineName = routine ? routine.name : "Workout";
              const date = new Date(workout.$createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              
              return (
                <Link key={workout.$id} href="/history" className="block rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{routineName}</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          <span>{date}</span>
                          {workout.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(workout.duration)}</span>}
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
