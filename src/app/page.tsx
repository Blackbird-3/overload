"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Activity, TrendingUp, Dumbbell } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-600/30 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-purple-600/20 blur-[120px]" />

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold leading-6 text-blue-400 ring-1 ring-inset ring-white/20 mb-8 backdrop-blur-md">
              The smartest way to build muscle
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent"
          >
            Progressive Overload, <br className="hidden sm:block" />
            Made Simple.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400"
          >
            Set your rep ranges. Log your workouts. Our algorithm automatically suggests when to increase weight or reps, ensuring you're always making progress.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex items-center justify-center gap-x-6"
          >
            <Link
              href="/signup"
              className="group rounded-full bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all flex items-center gap-2"
            >
              Start Tracking Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold leading-6 text-white hover:text-gray-300 transition-colors"
            >
              Log in <span aria-hidden="true">→</span>
            </Link>
          </motion.div>
        </div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {/* Card 1 */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 mb-6">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Smart Auto-Suggest</h3>
            <p className="text-gray-400">
              Never guess what weight to use next. Hit your target reps, and we'll calculate your next progression automatically.
            </p>
          </div>

          {/* Card 2 */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 mb-6">
              <Dumbbell className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Custom Routines</h3>
            <p className="text-gray-400">
              Build your own workout plans, define exercise orders, and set custom target rep ranges for every single movement.
            </p>
          </div>

          {/* Card 3 */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-400 mb-6">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Track Progress</h3>
            <p className="text-gray-400">
              Visualize your strength gains over time with beautiful charts and historical logs of all your past performances.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
