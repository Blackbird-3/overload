"use client";

import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { Activity, Dumbbell, Flame, Plus, Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Trophy, Star, Medal } from "lucide-react";
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

// Helper to get ISO week number
function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
}
// Helper to get ISO week string (e.g. 2026-W24)
function getISOWeekString(dateStr: string | number) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-W${getISOWeek(d).toString().padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalWorkouts: 0, activeStreak: 0, totalVolume: 0 });
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  
  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

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
        
        const wDates = new Set<string>(workouts.map((w: any) => new Date(w.$createdAt).toLocaleDateString()));
        setWorkoutDates(wDates);

        // 1. Calculate Active Streak (Weeks with >= 3 workouts)
        const uniqueWorkoutDatesByWeek = new Map<string, Set<string>>();
        workouts.forEach((w:any) => {
            const dateStr = new Date(w.$createdAt).toLocaleDateString();
            const weekStr = getISOWeekString(w.$createdAt);
            if (!uniqueWorkoutDatesByWeek.has(weekStr)) {
                uniqueWorkoutDatesByWeek.set(weekStr, new Set());
            }
            uniqueWorkoutDatesByWeek.get(weekStr)!.add(dateStr);
        });

        let streak = 0;
        const now = new Date();
        const currentWeekStr = getISOWeekString(now.toISOString());
        
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        const prevWeekStr = getISOWeekString(d.toISOString());

        let checkingWeekDate = new Date();
        let checkingWeekStr = currentWeekStr;
        
        const currentWeekCount = uniqueWorkoutDatesByWeek.get(currentWeekStr)?.size || 0;
        const prevWeekCount = uniqueWorkoutDatesByWeek.get(prevWeekStr)?.size || 0;

        if (currentWeekCount >= 3) {
            streak = 1;
            checkingWeekDate.setDate(checkingWeekDate.getDate() - 7);
            checkingWeekStr = getISOWeekString(checkingWeekDate.toISOString());
        } else if (prevWeekCount >= 3) {
            // Streak is alive from last week
            checkingWeekDate.setDate(checkingWeekDate.getDate() - 7); // Move to prev week
            checkingWeekStr = getISOWeekString(checkingWeekDate.toISOString());
        } else {
            streak = 0;
        }

        if (streak > 0 || (currentWeekCount < 3 && prevWeekCount >= 3)) {
            if (streak === 0) streak = 1; // Count previous week as streak=1
            while (true) {
                const count = uniqueWorkoutDatesByWeek.get(checkingWeekStr)?.size || 0;
                if (count >= 3) {
                    streak++;
                    checkingWeekDate.setDate(checkingWeekDate.getDate() - 7);
                    checkingWeekStr = getISOWeekString(checkingWeekDate.toISOString());
                } else {
                    break;
                }
            }
        }

        // 2. Calculate Total Volume (All time)
        const volume = sets.reduce((acc: number, s: any) => acc + ((s.weight || 0) * (s.reps || 0)), 0);

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

  // Calendar Helpers
  const daysInMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  // Achievements Logic
  const achievements = [];
  if (routines.length > 0) achievements.push({ id: 'first_routine', title: 'First Routine', icon: <Plus className="h-4 w-4 text-white" />, color: 'bg-blue-500' });
  if (stats.totalWorkouts >= 5) achievements.push({ id: '5_workouts', title: '5 Workouts', icon: <Dumbbell className="h-4 w-4 text-white" />, color: 'bg-green-500' });
  if (stats.totalWorkouts >= 10) achievements.push({ id: '10_workouts', title: '10 Workouts', icon: <Star className="h-4 w-4 text-white" />, color: 'bg-yellow-500' });
  if (stats.totalWorkouts >= 50) achievements.push({ id: '50_workouts', title: '50 Workouts', icon: <Trophy className="h-4 w-4 text-white" />, color: 'bg-purple-500' });
  if (stats.totalVolume >= 10000) achievements.push({ id: '10k_volume', title: '10k Volume', icon: <Medal className="h-4 w-4 text-white" />, color: 'bg-orange-500' });
  if (stats.activeStreak >= 4) achievements.push({ id: '4_week_streak', title: '1 Month Streak', icon: <Flame className="h-4 w-4 text-white" />, color: 'bg-red-500' });

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

      {/* Calendar Visualizer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Workout Calendar</h2>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="h-5 w-5 text-gray-400" /></button>
            <span className="text-white font-medium min-w-[100px] text-center">{monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-full transition-colors"><ChevronRight className="h-5 w-5 text-gray-400" /></button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-500 mb-2">{day}</div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), day).toLocaleDateString();
            const isWorkoutDay = workoutDates.has(dateStr);
            const isToday = new Date().toLocaleDateString() === dateStr;
            
            return (
              <div 
                key={day} 
                className={`h-10 flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all ${
                  isWorkoutDay 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                    : isToday
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-gray-400 hover:bg-white/5'
                }`}
              >
                {day}
                {isWorkoutDay && <div className="w-1 h-1 bg-blue-400 rounded-full mt-1"></div>}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Flame className="h-5 w-5" />
            <h3 className="font-medium text-sm">Active Streak</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {loading ? "-" : stats.activeStreak}
          </p>
          <p className="text-xs text-gray-400 mt-1">Weeks</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
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
          transition={{ duration: 0.4, delay: 0.4 }}
          className="col-span-2 sm:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Dumbbell className="h-5 w-5" />
            <h3 className="font-medium text-sm">All-Time Volume</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {loading ? "-" : stats.totalVolume.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">kg lifted</p>
        </motion.div>
      </div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Achievements</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {loading ? (
             <div className="text-sm text-gray-400">Loading achievements...</div>
          ) : achievements.length === 0 ? (
             <div className="text-sm text-gray-400">Complete workouts to earn achievements!</div>
          ) : (
            achievements.map(ach => (
              <div key={ach.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-2 pr-4 py-1.5 backdrop-blur-md">
                <div className={`${ach.color} p-1.5 rounded-full`}>
                  {ach.icon}
                </div>
                <span className="text-sm font-medium text-white">{ach.title}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>

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
                        <CalendarIcon className="h-5 w-5" />
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
