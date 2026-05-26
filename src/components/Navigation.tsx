"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListPlus, Activity, History, Settings } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Routines", href: "/routines", icon: ListPlus },
  { name: "Workout", href: "/workout/new", icon: Activity },
  { name: "History", href: "/history", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex flex-col w-64 bg-white/5 border-r border-white/10 p-4 h-full backdrop-blur-xl">
        <div className="flex items-center gap-2 px-2 py-6">
          <Activity className="h-8 w-8 text-blue-500" />
          <span className="text-xl font-bold text-white">Overload</span>
        </div>
        <div className="space-y-2 mt-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 border-t border-white/10 backdrop-blur-xl pb-safe">
        <div className="flex items-center justify-around p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl min-w-[64px] transition-colors",
                  isActive ? "text-blue-500" : "text-gray-400 hover:text-white"
                )}
              >
                <div className={cn(
                  "p-1 rounded-full transition-colors",
                  isActive && "bg-blue-500/20"
                )}>
                  <item.icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
