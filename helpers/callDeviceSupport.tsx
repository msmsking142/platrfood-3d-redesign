export type CallSupport = {
  available: boolean;
  reason: string | null;
};

export function getCallSupport(): CallSupport {
  if (
    !window.isSecureContext ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof RTCPeerConnection === "undefined"
  ) {
    return {
      available: false,
      reason:
        "In-app calling isn't supported on this device/browser. Please update the app or use Contact Support.",
    };
  }

  return { available: true, reason: null };
}

export function getMicrophoneErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission is blocked. Allow microphone for platr™ in your phone/browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found on this device";
  }
  if (name === "NotReadableError") {
    return "Microphone is busy in another app";
  }
  return "Could not access the microphone";
}