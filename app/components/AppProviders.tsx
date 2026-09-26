"use client";
import type { ReactNode } from "react";
import { WeekendProvider } from "../lib/weekend-context";
import { ToastProvider } from "./ui/Toast";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WeekendProvider>{children}</WeekendProvider>
    </ToastProvider>
  );
}
