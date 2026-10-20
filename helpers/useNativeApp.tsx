import { useSyncExternalStore } from "react";
import { isNativeApp } from "./isNativeApp";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export function useNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isNativeApp, () => false);
}