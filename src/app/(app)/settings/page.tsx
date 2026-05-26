"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, User as UserIcon, Bell, Shield, Moon, Check, Download, Trash2, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { account, APPWRITE_CONFIG } from "@/lib/appwrite";
import { offlineSync } from "@/lib/offlineSync";
import { Query } from "appwrite";

export default function SettingsPage() {
  const { user, logout, checkSession } = useAuth();
  
  // Profile Edit
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Theme & Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (user) setNewName(user.name);
    setNotificationsEnabled(localStorage.getItem("notifications_enabled") === "true");
  }, [user]);

  const saveName = async () => {
    if (!newName.trim() || newName === user?.name) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await account.updateName(newName);
      await checkSession(); // Refresh context
      setIsEditingName(false);
    } catch (error: any) {
      alert("Failed to update name: " + error.message);
    } finally {
      setSavingName(false);
    }
  };

  const toggleTheme = () => {
    alert("Light mode is too bright for lifting! Protect your eyes and embrace the dark. 🦇🏋️‍♂️");
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          localStorage.setItem("notifications_enabled", "true");
          setNotificationsEnabled(true);
          new Notification("Notifications Enabled", { body: "You'll get reminders to crush your workouts!" });
        } else {
          alert("Notification permission denied by browser.");
        }
      } else {
        alert("Your browser does not support notifications.");
      }
    } else {
      localStorage.setItem("notifications_enabled", "false");
      setNotificationsEnabled(false);
    }
  };

  const downloadData = async () => {
    if (!user) return;
    try {
      const [workouts, sets, routines] = await Promise.all([
        offlineSync.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.workoutsCollectionId, [Query.equal("userId", user.$id), Query.limit(5000)]),
        offlineSync.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.setsCollectionId, [Query.equal("userId", user.$id), Query.limit(5000)]),
        offlineSync.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.routinesCollectionId, [Query.equal("userId", user.$id), Query.limit(100)])
      ]);

      const data = {
        user: { id: user.$id, name: user.name, email: user.email },
        routines: routines.documents,
        workouts: workouts.documents,
        sets: sets.documents,
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overload_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export data.");
    }
  };

  const clearLocalCache = () => {
    if (confirm("This will clear all local cache and pending offline saves. You will need an internet connection to sync again. Are you sure?")) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      keys.forEach(k => {
        if (k?.startsWith("cache_") || k === "offline_mutations") {
          localStorage.removeItem(k);
        }
      });
      alert("Local cache cleared. Please refresh the app while online.");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 text-white pb-20">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xl font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  <button onClick={saveName} disabled={savingName} className="p-1.5 bg-blue-600 rounded text-white hover:bg-blue-500">
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{user?.name}</h2>
                  <button onClick={() => setIsEditingName(true)} className="text-blue-400 text-xs hover:underline">Edit</button>
                </div>
              )}
              <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500/10 text-red-500 py-3 font-medium hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-md">
          <button onClick={toggleTheme} className="w-full p-4 border-b border-white/10 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-gray-800 p-2 rounded-lg"><Sun className="h-5 w-5" /></div>
              <span>Theme</span>
            </div>
            <span className="text-sm font-medium bg-black/50 px-2 py-1 rounded text-gray-300">Dark</span>
          </button>
          
          <button onClick={toggleNotifications} className="w-full p-4 border-b border-white/10 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-gray-800 p-2 rounded-lg"><Bell className="h-5 w-5" /></div>
              <span>Notifications</span>
            </div>
            <div className={`w-10 h-5 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}>
              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${notificationsEnabled ? 'left-[22px]' : 'left-1'}`} />
            </div>
          </button>
        </div>

        {/* Data & Privacy */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-md">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/5">
            <Shield className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium text-gray-300">Data & Privacy</h3>
          </div>
          
          <button onClick={downloadData} className="w-full p-4 border-b border-white/10 flex items-center justify-between hover:bg-white/5 transition-colors text-left">
            <div>
              <div className="font-medium">Download Data</div>
              <div className="text-xs text-gray-400">Export all your workouts and routines to JSON</div>
            </div>
            <Download className="h-5 w-5 text-blue-400" />
          </button>

          <button onClick={clearLocalCache} className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left">
            <div>
              <div className="font-medium text-red-400">Clear Local Cache</div>
              <div className="text-xs text-red-400/70">Wipes offline database. Do not use if you have unsynced workouts!</div>
            </div>
            <Trash2 className="h-5 w-5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
