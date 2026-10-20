type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;

  const capacitor = (window as CapacitorWindow).Capacitor;
  if (capacitor?.isNativePlatform?.() === true) return true;

  return (
    window.location.hostname.endsWith(".sandbox.floot.app") &&
    window.innerWidth <= 760
  );
}