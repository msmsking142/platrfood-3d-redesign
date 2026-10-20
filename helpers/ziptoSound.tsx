import { scheduleOrderRing } from "./ziptoOrderRing";

type ReadyListener = (ready: boolean) => void;

const listeners = new Set<ReadyListener>();
let audioContext: AudioContext | null = null;
let resumePromise: Promise<void> | null = null;

function notifyListeners() {
  const ready = audioContext?.state === "running";
  for (const listener of listeners) listener(ready);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;

  const browserWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : browserWindow.webkitAudioContext;

  if (!AudioContextConstructor) return null;

  try {
    const createdContext = new AudioContextConstructor();
    audioContext = createdContext;
    createdContext.addEventListener("statechange", notifyListeners);
    notifyListeners();
    return createdContext;
  } catch (error) {
    console.error("platr™ audio could not be initialized:", error);
    return null;
  }
}

function scheduleTone(
  context: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  peakGain: number,
  attack: number,
  releaseStart: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(context.destination);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + attack);
  gain.gain.setValueAtTime(peakGain, start + releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration - 0.005);

  oscillator.addEventListener(
    "ended",
    () => {
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true },
  );

  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playToggleTones(on: boolean) {
  const context = audioContext;
  if (!context || context.state !== "running") return;

  const start = context.currentTime;
  const frequencies = on ? [660, 990] : [990, 520];

  try {
    frequencies.forEach((frequency, index) => {
      scheduleTone(
        context,
        frequency,
        start + index * 0.075,
        0.075,
        0.08,
        0.012,
        0.045,
      );
    });
  } catch (error) {
    console.error("platr™ toggle sound could not be played:", error);
  }
}

function playStatusTones(kind: "good" | "bad") {
  const context = audioContext;
  if (!context || context.state !== "running") return;

  const frequencies = kind === "good" ? [523, 659, 784] : [440, 330];
  const start = context.currentTime;

  try {
    frequencies.forEach((frequency, index) => {
      scheduleTone(
        context,
        frequency,
        start + index * 0.12,
        0.16,
        0.065,
        0.02,
        0.11,
      );
    });
  } catch (error) {
    console.error("platr™ status chime could not be played:", error);
  }
}

export const ziptoSound = {
  unlock(): Promise<void> {
    const context = getAudioContext();
    if (!context || context.state === "running") return Promise.resolve();
    if (resumePromise) return resumePromise;

    try {
      resumePromise = context
        .resume()
        .then(() => {
          notifyListeners();
        })
        .catch((error: unknown) => {
          console.error("platr™ audio could not be resumed:", error);
        })
        .finally(() => {
          resumePromise = null;
        });
      return resumePromise;
    } catch (error) {
      console.error("platr™ audio could not be resumed:", error);
      return Promise.resolve();
    }
  },

  isReady(): boolean {
    return audioContext?.state === "running";
  },

  subscribe(listener: ReadyListener): () => void {
    listeners.add(listener);
    listener(ziptoSound.isReady());
    return () => {
      listeners.delete(listener);
    };
  },

  playToggle(on: boolean): void {
    const resumed = ziptoSound.unlock();

    if (ziptoSound.isReady()) {
      playToggleTones(on);
    } else {
      void resumed.then(() => {
        if (ziptoSound.isReady()) playToggleTones(on);
      });
    }
  },

  playStatusChime(kind: "good" | "bad"): void {
    const resumed = ziptoSound.unlock();

    if (ziptoSound.isReady()) {
      playStatusTones(kind);
    } else {
      void resumed.then(() => {
        if (ziptoSound.isReady()) playStatusTones(kind);
      });
    }
  },

  playOrderRing(): boolean {
    const context = audioContext;
    if (!context || context.state !== "running") return false;

    try {
      return scheduleOrderRing(context);
    } catch (error) {
      console.error("platr™ order ring could not be played:", error);
      return false;
    }
  },
};

if (typeof window !== "undefined") {
  const unlockOnGesture = () => {
    void ziptoSound.unlock();
  };
  const gestureOptions: AddEventListenerOptions = {
    capture: true,
    passive: true,
  };

  for (const eventName of ["pointerdown", "touchend", "click", "keydown"]) {
    window.addEventListener(eventName, unlockOnGesture, gestureOptions);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && audioContext) {
      void ziptoSound.unlock();
    }
  });
}