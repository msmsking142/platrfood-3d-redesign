import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { postCallStart } from "../endpoints/call/start_POST.schema";
import { postCallSignal } from "../endpoints/call/signal_POST.schema";
import {
  getCallSupport,
  getMicrophoneErrorMessage,
  type CallSupport,
} from "../helpers/callDeviceSupport";
import { channels } from "../helpers/realtimeChannels";
import { useAuth } from "../helpers/useAuth";
import { Button } from "./Button";
import { useRealtimeChannel } from "./FlootRealtimeProvider";
import styles from "./CallProvider.module.css";

type Target = "rider" | "customer" | "restaurant";
type CallStatus = "incoming" | "outgoing" | "connecting" | "connected";

export type CallState =
  | { status: "idle" }
  | {
      status: CallStatus;
      direction: "incoming" | "outgoing";
      callId: string;
      orderId: number;
      name: string;
      role: string;
      connectedAt?: number;
    };

type ActiveCall = Extract<CallState, { callId: string }>;

const messageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("incoming"),
    callId: z.string().uuid(),
    orderId: z.number(),
    callerName: z.string(),
    callerRole: z.string(),
  }),
  z.object({
    type: z.literal("signal"),
    callId: z.string().uuid(),
    kind: z.enum([
      "accept",
      "decline",
      "hangup",
      "missed",
      "offer",
      "answer",
      "ice",
    ]),
    payload: z.unknown().optional(),
  }),
]);
const descriptionSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string(),
});
const candidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type CallContextValue = {
  startCall: (orderId: number, target: Target) => Promise<void>;
  state: CallState;
  support: CallSupport;
  accept: () => Promise<void>;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  muted: boolean;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): Pick<CallContextValue, "startCall" | "state" | "support"> {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used inside CallProvider");
  return {
    startCall: context.startCall,
    state: context.state,
    support: context.support,
  };
}

function useCallControls(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) throw new Error("Call controls require CallProvider");
  return context;
}

function CallOverlay() {
  const { state, accept, decline, hangUp, toggleMute, muted } =
    useCallControls();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state.status !== "connected" || !state.connectedAt) {
      setElapsed(0);
      return;
    }
    const connectedAt = state.connectedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.status, state.status === "connected" ? state.connectedAt : undefined]);

  if (state.status === "idle") return null;

  const clock = new Intl.NumberFormat("en-IN", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const statusText =
    state.status === "connected"
      ? `${clock.format(Math.floor(elapsed / 60))}:${clock.format(elapsed % 60)}`
      : state.status === "incoming"
        ? "Ringing…"
        : state.status === "outgoing"
          ? "Calling…"
          : "Connecting…";

  return (
    <aside className={styles.overlay} aria-label="platr™ voice call">
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">
          {state.name.trim().charAt(0).toLocaleUpperCase() || "Z"}
        </span>
        <div className={styles.details}>
          <strong className={styles.name}>{state.name}</strong>
          <span className={styles.subtitle}>
            {state.role} · Order #{state.orderId}
          </span>
        </div>
      </div>

      <p className={styles.status} role="status">
        {statusText}
      </p>

      <div className={styles.actions}>
        {state.status === "incoming" ? (
          <>
            <Button
              className={styles.accept}
              onClick={() => void accept()}
              aria-label="Accept call"
            >
              <Phone size={18} aria-hidden="true" /> Accept
            </Button>
            <Button
              className={styles.end}
              onClick={decline}
              aria-label="Decline call"
            >
              <PhoneOff size={18} aria-hidden="true" /> Decline
            </Button>
          </>
        ) : (
          <>
            {(state.status === "connecting" ||
              state.status === "connected") && (
              <Button
                variant="ghost"
                className={styles.mute}
                onClick={toggleMute}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                aria-pressed={muted}
              >
                {muted ? (
                  <MicOff size={18} aria-hidden="true" />
                ) : (
                  <Mic size={18} aria-hidden="true" />
                )}
                {muted ? "Unmute" : "Mute"}
              </Button>
            )}
            <Button
              className={styles.end}
              onClick={hangUp}
              aria-label="Hang up"
            >
              <PhoneOff size={18} aria-hidden="true" /> Hang up
            </Button>
          </>
        )}
      </div>
      <p className={styles.privacy}>Numbers stay private on platr™ calls</p>
    </aside>
  );
}

export function CallProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { authState } = useAuth();
  const [support] = useState(getCallSupport);
  const userId =
    authState.type === "authenticated" ? authState.user.id : null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [state, setState] = useState<CallState>({ status: "idle" });
  const stateRef = useRef<CallState>({ status: "idle" });
  const [muted, setMuted] = useState(false);
  const startingRef = useRef(false);
  const microphoneRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const updateState = (next: CallState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  };

  const isCurrent = (callId: string) => {
    const current = stateRef.current;
    return current.status !== "idle" && current.callId === callId;
  };

  const clearTimeoutIfSet = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const release = (notify: boolean, showToast?: string) => {
    const current = stateRef.current;
    if (current.status === "idle") return;

    updateState({ status: "idle" });
    clearTimeoutIfSet();
    iceQueueRef.current = [];

    const peer = peerRef.current;
    peerRef.current = null;
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
    }
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    remoteStreamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setMuted(false);

    if (notify) {
      void postCallSignal({
        callId: current.callId,
        kind: "hangup",
      }).catch((error: unknown) => {
        console.error("Could not notify the other caller of hangup:", error);
      });
    }
    if (showToast) toast.info(showToast);
  };

  const requestMicrophone = async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is unavailable in this browser");
      }
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      console.error(
        "platr™ call microphone error:",
        error instanceof Error ? error.name : "Unknown error",
      );
      toast.error(getMicrophoneErrorMessage(error));
      return null;
    }
  };

  const flushIce = async (peer: RTCPeerConnection) => {
    const candidates = iceQueueRef.current.splice(0);
    for (const candidate of candidates) {
      await peer.addIceCandidate(candidate);
    }
  };

  const createPeer = (callId: string): RTCPeerConnection => {
    if (peerRef.current) return peerRef.current;
    const microphone = microphoneRef.current;
    if (!microphone) throw new Error("Microphone is not ready for this call");

    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;
    microphone.getTracks().forEach((track) => peer.addTrack(track, microphone));

    peer.ontrack = (event) => {
      if (!isCurrent(callId)) return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      remoteStreamRef.current = stream;
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        void audioRef.current.play().catch((error: unknown) => {
          console.error("Call audio playback was blocked:", error);
          toast.error("Tap the call panel to enable call audio");
        });
      }
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || !isCurrent(callId)) return;
      const candidate = event.candidate;
      void postCallSignal({
        callId,
        kind: "ice",
        payload: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        },
      }).catch((error: unknown) =>
        console.error("Could not send ICE candidate:", error),
      );
    };

    peer.onconnectionstatechange = () => {
      if (!isCurrent(callId) || peerRef.current !== peer) return;
      if (peer.connectionState === "connected") {
        clearTimeoutIfSet();
        const current = stateRef.current as ActiveCall;
        updateState({
          ...current,
          status: "connected",
          connectedAt: current.connectedAt ?? Date.now(),
        });
      } else if (peer.connectionState === "failed") {
        release(
          true,
          "Call couldn't connect on this network. Try again on Wi-Fi/mobile data, or use Contact Support at /support.",
        );
      } else if (peer.connectionState === "closed") {
        release(false, "Call ended");
      }
    };
    return peer;
  };

  const handleSignal = async (
    message: Extract<z.infer<typeof messageSchema>, { type: "signal" }>,
  ) => {
    const current = stateRef.current;
    if (current.status === "idle" || current.callId !== message.callId) return;
    const callId = message.callId;

    try {
      if (message.kind === "hangup" || message.kind === "missed") {
        release(false, "Call ended");
        return;
      }
      if (message.kind === "decline") {
        release(false, "Call declined");
        return;
      }
      if (message.kind === "accept" && current.status === "outgoing") {
        updateState({ ...current, status: "connecting" });
        const peer = createPeer(callId);
        const offer = await peer.createOffer();
        if (!isCurrent(callId)) return;
        await peer.setLocalDescription(offer);
        await postCallSignal({
          callId,
          kind: "offer",
          payload: { type: offer.type, sdp: offer.sdp ?? "" },
        });
      } else if (message.kind === "offer") {
        const description = descriptionSchema.parse(message.payload);
        if (description.type !== "offer" || current.direction !== "incoming")
          return;
        const peer = createPeer(callId);
        await peer.setRemoteDescription(description);
        if (!isCurrent(callId)) return;
        await flushIce(peer);
        const answer = await peer.createAnswer();
        if (!isCurrent(callId)) return;
        await peer.setLocalDescription(answer);
        await postCallSignal({
          callId,
          kind: "answer",
          payload: { type: answer.type, sdp: answer.sdp ?? "" },
        });
      } else if (message.kind === "answer") {
        const description = descriptionSchema.parse(message.payload);
        if (description.type !== "answer" || current.direction !== "outgoing")
          return;
        const peer = peerRef.current;
        if (!peer) throw new Error("Received an answer without an active peer");
        await peer.setRemoteDescription(description);
        if (isCurrent(callId)) await flushIce(peer);
      } else if (message.kind === "ice") {
        const candidate = candidateSchema.parse(message.payload);
        const peer = peerRef.current;
        if (peer?.remoteDescription) {
          await peer.addIceCandidate(candidate);
        } else {
          iceQueueRef.current.push(candidate);
        }
      }
    } catch (error) {
      console.error("platr™ call signaling failed:", error);
      if (isCurrent(callId)) release(true, "Call connection failed – try again");
    }
  };

  useRealtimeChannel(
    userId === null ? null : channels.callInbox(userId),
    (raw: unknown) => {
      const result = messageSchema.safeParse(raw);
      if (!result.success || userIdRef.current === null) {
        console.error("Invalid platr™ call message");
        return;
      }
      const message = result.data;
      if (message.type === "signal") {
        void handleSignal(message);
        return;
      }
      if (isCurrent(message.callId)) return;
      if (!support.available) {
        console.warn("Declining unsupported platr™ call", message.callId);
        void postCallSignal({
          callId: message.callId,
          kind: "decline",
        }).catch(() => {
          console.error("Could not decline unsupported platr™ call", message.callId);
        });
        return;
      }
      if (stateRef.current.status !== "idle" || startingRef.current) {
        void postCallSignal({
          callId: message.callId,
          kind: "decline",
        }).catch((error: unknown) =>
          console.error("Could not decline a call while busy:", error),
        );
        return;
      }

      updateState({
        status: "incoming",
        direction: "incoming",
        callId: message.callId,
        orderId: message.orderId,
        name: message.callerName,
        role: message.callerRole,
      });
      timeoutRef.current = window.setTimeout(() => {
        const current = stateRef.current;
        if (current.status === "incoming" && current.callId === message.callId) {
          release(false);
        }
      }, 40_000);
    },
  );

  const startCall = async (orderId: number, target: Target): Promise<void> => {
    if (!support.available) {
      toast.error(support.reason);
      return;
    }
    if (userIdRef.current === null) {
      toast.error("Sign in to make a platr™ call");
      return;
    }
    if (startingRef.current || stateRef.current.status !== "idle") {
      toast.error("Finish your current call first");
      return;
    }
    startingRef.current = true;
    try {
      const microphone = await requestMicrophone();
      if (!microphone) return;
      if (userIdRef.current === null || !mountedRef.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneRef.current = microphone;
      const response = await postCallStart({ orderId, target });
      if (userIdRef.current === null || !mountedRef.current) {
        microphone.getTracks().forEach((track) => track.stop());
        microphoneRef.current = null;
        void postCallSignal({
          callId: response.callId,
          kind: "hangup",
        }).catch((error: unknown) =>
          console.error("Could not end call after sign-out:", error),
        );
        return;
      }

      updateState({
        status: "outgoing",
        direction: "outgoing",
        callId: response.callId,
        orderId,
        name: response.calleeName,
        role:
          target === "rider"
            ? "Rider"
            : target === "customer"
              ? "Customer"
              : "Restaurant",
      });
      timeoutRef.current = window.setTimeout(() => {
        const current = stateRef.current;
        if (
          current.status === "outgoing" &&
          current.callId === response.callId
        ) {
          void postCallSignal({
            callId: response.callId,
            kind: "missed",
          }).catch((error: unknown) =>
            console.error("Could not mark call missed:", error),
          );
          release(false);
          toast.info("No answer – they may not have the platr™ app open");
        }
      }, 40_000);
    } catch (error) {
      console.error("Could not start platr™ call:", error);
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      toast.error(error instanceof Error ? error.message : "Could not start call");
    } finally {
      startingRef.current = false;
    }
  };

  const accept = async () => {
    const current = stateRef.current;
    if (current.status !== "incoming") return;
    clearTimeoutIfSet();
    updateState({ ...current, status: "connecting" });
    const microphone = await requestMicrophone();
    if (!microphone) {
      void postCallSignal({
        callId: current.callId,
        kind: "decline",
      }).catch((error: unknown) =>
        console.error("Could not decline call after mic error:", error),
      );
      release(false);
      return;
    }
    if (!isCurrent(current.callId)) {
      microphone.getTracks().forEach((track) => track.stop());
      return;
    }
    microphoneRef.current = microphone;
    try {
      createPeer(current.callId);
      await postCallSignal({ callId: current.callId, kind: "accept" });
    } catch (error) {
      console.error("Could not accept platr™ call:", error);
      release(true, "Call connection failed – try again");
    }
  };

  const decline = () => {
    const current = stateRef.current;
    if (current.status !== "incoming") return;
    void postCallSignal({
      callId: current.callId,
      kind: "decline",
    }).catch((error: unknown) => console.error("Could not decline call:", error));
    release(false);
  };

  const toggleMute = () => {
    const next = !muted;
    microphoneRef.current
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = !next));
    setMuted(next);
  };

  useEffect(() => {
    if (state.status !== "connecting") return;

    const callId = state.callId;
    const timer = window.setTimeout(() => {
      const current = stateRef.current;
      if (current.status === "connecting" && current.callId === callId) {
        release(
          true,
          "Call couldn't connect on this network. Try again on Wi-Fi/mobile data, or use Contact Support at /support.",
        );
      }
    }, 25_000);

    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state.status !== "incoming" && state.status !== "outgoing") return;

    let context: AudioContext | null = null;
    let timer: number | undefined;
    const incoming = state.status === "incoming";

    try {
      context = new AudioContext();
      const audioContext = context;
      const ring = () => {
        if (audioContext.state === "closed") return;
        const start = audioContext.currentTime;
        for (const frequency of incoming ? [440, 480] : [425]) {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.frequency.value = frequency;
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.055, start + 0.03);
          gain.gain.setValueAtTime(0.055, start + 0.55);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
          oscillator.start(start);
          oscillator.stop(start + 0.82);
        }
        if (incoming) navigator.vibrate?.([350, 250, 350]);
      };
      void audioContext.resume().then(ring).catch((error: unknown) => {
        console.warn("Call ringtone could not play:", error);
      });
      timer = window.setInterval(ring, incoming ? 2500 : 3000);
    } catch (error) {
      console.warn("Web Audio ringtone is unavailable:", error);
    }

    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      if (incoming) navigator.vibrate?.(0);
      if (context) {
        void context.close().catch((error: unknown) =>
          console.warn("Could not close ringtone audio:", error),
        );
      }
    };
  }, [state.status]);

  const previousUserIdRef = useRef(userId);
  useEffect(() => {
    if (previousUserIdRef.current !== userId) {
      release(true);
      previousUserIdRef.current = userId;
    }
  }, [userId]);

  useEffect(() => {
    const beforeUnload = () => {
      const current = stateRef.current;
      if (current.status !== "idle") {
        void postCallSignal(
          { callId: current.callId, kind: "hangup" },
          { keepalive: true },
        ).catch((error: unknown) =>
          console.error("Could not notify call hangup on page exit:", error),
        );
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      release(true);
      mountedRef.current = false;
    };
  }, []);

  return (
    <CallContext.Provider
      value={{
        startCall,
        state,
        support,
        accept,
        decline,
        hangUp: () => release(true),
        toggleMute,
        muted,
      }}
    >
      <div className={className}>
        {children}
        <audio ref={audioRef} className={styles.remoteAudio} autoPlay playsInline />
        <CallOverlay />
      </div>
    </CallContext.Provider>
  );
}