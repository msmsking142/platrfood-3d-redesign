import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  academyHindiVoice,
  academyScenes,
  academySentences,
  academyTiming,
  academyVoiceIsMale,
} from "../helpers/academyScenes";
import { MerchantAcademyScreens } from "./MerchantAcademyScreens";
import { ZiptoLogo } from "./ZiptoLogo";
import styles from "./HindiOnboardingVideo.module.css";

const clock = new Intl.NumberFormat("en-IN", {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

const formatTime = (seconds: number): string => {
  const whole = Math.floor(seconds);
  return `${clock.format(Math.floor(whole / 60))}:${clock.format(whole % 60)}`;
};

export const HindiOnboardingVideo = ({
  onComplete,
  completed = false,
  scenes = academyScenes,
  renderScreen,
  endTitle = "वीडियो पूरा हुआ ✓",
  endText = "अब आप platr™ पर अपना आउटलेट रजिस्टर करने के लिए तैयार हैं।",
  ariaLabel = "platr™ Partner Academy हिंदी वीडियो",
  className,
}: {
  onComplete?: () => void;
  completed?: boolean;
  scenes?: readonly { narration: string }[];
  renderScreen?: (sceneIndex: number, progress: number) => ReactNode;
  endTitle?: string;
  endText?: string;
  ariaLabel?: string;
  className?: string;
}) => {
  if (scenes.length === 0) {
    throw new Error("HindiOnboardingVideo requires at least one scene.");
  }

  const timing = useMemo(() => academyTiming(scenes), [scenes]);
  const { durations, offsets, total } = timing;
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [revision, setRevision] = useState(0);

  const elapsedRef = useRef(0);
  const furthestRef = useRef(0);
  const completedOnceRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const musicRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  onCompleteRef.current = onComplete;

  // Called directly from a click so browsers permit the AudioContext to start.
  const activateMusic = () => {
    try {
      if (!musicRef.current) {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0.12;
        master.connect(context.destination);
        musicRef.current = context;
        masterRef.current = master;
      }
      void musicRef.current.resume().catch((error: unknown) => {
        console.warn("Background music could not start:", error);
      });
    } catch (error) {
      console.warn("Web Audio is unavailable; continuing without music:", error);
    }
  };

  useEffect(() => {
    if (!playing || ended || muted || !musicRef.current || !masterRef.current) return;

    const context = musicRef.current;
    const master = masterRef.current;
    const sources = new Set<OscillatorNode | AudioBufferSourceNode>();
    const eighth = 60 / 112 / 2;
    const chords = [
      { bass: 110, notes: [220, 261.63, 329.63] },
      { bass: 87.31, notes: [174.61, 220, 261.63] },
      { bass: 130.81, notes: [196, 261.63, 329.63] },
      { bass: 98, notes: [196, 246.94, 293.66] },
    ];
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.09), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;

    const tone = (
      frequency: number,
      time: number,
      length: number,
      level: number,
      type: OscillatorType,
      cutoff: number,
    ): OscillatorNode => {
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, time);
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      envelope.gain.setValueAtTime(0.001, time);
      envelope.gain.exponentialRampToValueAtTime(level, time + 0.02);
      oscillator.connect(filter);
      filter.connect(envelope);
      envelope.connect(master);
      sources.add(oscillator);
      oscillator.onended = () => sources.delete(oscillator);
      oscillator.start(time);
      oscillator.stop(time + length + 0.01);
      return oscillator;
    };

    let step = 0;
    let nextTime = context.currentTime + 0.04;
    const schedule = () => {
      if (context.state !== "running") return;
      if (nextTime < context.currentTime) nextTime = context.currentTime + 0.04;
      while (nextTime < context.currentTime + 0.1) {
        const chord = chords[Math.floor(step / 8) % chords.length];
        if (step % 2 === 0) {
          const kick = tone(140, nextTime, 0.19, 0.48, "sine", 300);
          kick.frequency.exponentialRampToValueAtTime(45, nextTime + 0.17);
          tone(step % 8 === 6 ? chord.bass * 1.5 : chord.bass, nextTime, 0.25, 0.23, "triangle", 420);
        } else {
          const hat = context.createBufferSource();
          const filter = context.createBiquadFilter();
          const envelope = context.createGain();
          hat.buffer = noise;
          filter.type = "highpass";
          filter.frequency.value = 6500;
          envelope.gain.setValueAtTime(0.075, nextTime);
          envelope.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.08);
          hat.connect(filter);
          filter.connect(envelope);
          envelope.connect(master);
          sources.add(hat);
          hat.onended = () => sources.delete(hat);
          hat.start(nextTime);
          hat.stop(nextTime + 0.09);
        }
        if (step % 8 === 0) {
          for (const note of chord.notes) {
            tone(note, nextTime, eighth * 7.8, 0.055, "sine", 1000);
          }
        }
        step += 1;
        nextTime += eighth;
      }
    };

    void context.resume().catch((error: unknown) => {
      console.warn("Background music could not resume:", error);
    });
    const scheduler = window.setInterval(schedule, 25);
    schedule();

    return () => {
      window.clearInterval(scheduler);
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // A source that already finished needs no further cleanup.
        }
      }
      void context.suspend().catch((error: unknown) => {
        console.warn("Background music could not pause:", error);
      });
    };
  }, [playing, ended, muted]);

  useEffect(() => () => {
    const context = musicRef.current;
    musicRef.current = null;
    masterRef.current = null;
    if (context) {
      void context.close().catch((error: unknown) => {
        console.warn("Background music could not close:", error);
      });
    }
  }, []);

  useEffect(() => {
    if (!playing || ended) return;

    const duration = durations[sceneIndex];
    let active = true;
    let advancing = false;
    let usingSpeech = false;
    let lastTick = performance.now();
    let voiceTimeout: number | undefined;
    let removeVoicesListener: (() => void) | undefined;
    const synthesis = window.speechSynthesis;

    const setMusicLevel = (level: number) => {
      const context = musicRef.current;
      const master = masterRef.current;
      if (context && master) master.gain.setTargetAtTime(level, context.currentTime, 0.06);
    };

    const advance = () => {
      if (!active || advancing) return;
      advancing = true;
      furthestRef.current = Math.max(furthestRef.current, offsets[sceneIndex] + duration);
      elapsedRef.current = duration;
      setElapsed(duration);

      if (sceneIndex === scenes.length - 1) {
        setPlaying(false);
        setEnded(true);
        if (!completedOnceRef.current) {
          completedOnceRef.current = true;
          onCompleteRef.current?.();
        }
      } else {
        elapsedRef.current = 0;
        setElapsed(0);
        setSceneIndex(sceneIndex + 1);
      }
    };

    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      if (!active || advancing) return;

      const next = Math.min(elapsedRef.current + delta, usingSpeech ? duration - 0.01 : duration);
      elapsedRef.current = next;
      furthestRef.current = Math.max(furthestRef.current, offsets[sceneIndex] + next);
      setElapsed(next);
      if (!usingSpeech && next >= duration) advance();
    }, 100);

    const startNarration = () => {
      if (!active || advancing || !synthesis) return;
      const sentences = academySentences(scenes[sceneIndex].narration);
      const voice = academyHindiVoice(synthesis.getVoices());
      let sentenceIndex = 0;

      const speakNext = () => {
        if (!active || advancing) return;
        setMusicLevel(0.12);
        if (sentenceIndex >= sentences.length) {
          advance();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentences[sentenceIndex]);
        sentenceIndex += 1;
        utterance.lang = "hi-IN";
        utterance.rate = 1.3;
        utterance.pitch = voice && academyVoiceIsMale(voice) ? 0.75 : 0.6;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        utterance.onstart = () => {
          if (active) setMusicLevel(0.07);
        };
        utterance.onend = speakNext;
        utterance.onerror = (event) => {
          if (!active) return;
          console.warn("Hindi narration unavailable; continuing with timed playback:", event.error);
          utterance.onend = null;
          usingSpeech = false;
          setMusicLevel(0.12);
          synthesis.cancel();
        };

        try {
          synthesis.speak(utterance);
        } catch (error) {
          console.error("Could not play Hindi narration:", error);
          usingSpeech = false;
          setMusicLevel(0.12);
        }
      };

      usingSpeech = true;
      speakNext();
    };

    if (!muted && synthesis && typeof SpeechSynthesisUtterance !== "undefined") {
      if (synthesis.getVoices().length > 0) {
        startNarration();
      } else {
        const onVoicesChanged = () => {
          if (voiceTimeout !== undefined) window.clearTimeout(voiceTimeout);
          synthesis.removeEventListener("voiceschanged", onVoicesChanged);
          removeVoicesListener = undefined;
          startNarration();
        };
        synthesis.addEventListener("voiceschanged", onVoicesChanged);
        removeVoicesListener = () => synthesis.removeEventListener("voiceschanged", onVoicesChanged);
        voiceTimeout = window.setTimeout(() => {
          removeVoicesListener?.();
          removeVoicesListener = undefined;
          startNarration();
        }, 1000);
      }
    }

    return () => {
      active = false;
      window.clearInterval(timer);
      if (voiceTimeout !== undefined) window.clearTimeout(voiceTimeout);
      removeVoicesListener?.();
      synthesis?.cancel();
      setMusicLevel(0.12);
    };
  }, [playing, ended, muted, sceneIndex, revision, durations, offsets, scenes]);

  const restartCurrentScene = () => {
    elapsedRef.current = 0;
    setElapsed(0);
    setRevision((value) => value + 1);
  };

  const replay = () => {
    if (!muted) activateMusic();
    elapsedRef.current = 0;
    setElapsed(0);
    setSceneIndex(0);
    setRevision((value) => value + 1);
    setEnded(false);
    setStarted(true);
    setPlaying(true);
  };

  const revisitScene = (index: number) => {
    if (!started || ended || offsets[index] > furthestRef.current) return;
    elapsedRef.current = 0;
    setElapsed(0);
    setSceneIndex(index);
    setRevision((value) => value + 1);
  };

  const currentTime = ended ? total : offsets[sceneIndex] + elapsed;
  const progress = elapsed / durations[sceneIndex];

  return (
    <section className={`${styles.player} ${className ?? ""}`} aria-label={ariaLabel}>
      <span className={styles.watermark} aria-hidden="true">
        <ZiptoLogo size={22} />
      </span>
      <div className={styles.topOverlay}>
        <div className={styles.segments} role="group" aria-label="देखे हुए भागों पर जाएँ">
          {scenes.map((_, index) => (
            <button
              key={index}
              className={styles.segmentButton}
              type="button"
              disabled={!started || ended || offsets[index] > furthestRef.current}
              onClick={() => revisitScene(index)}
              aria-label={`भाग ${index + 1} फिर से देखें`}
              aria-current={started && !ended && sceneIndex === index ? "step" : undefined}
            >
              <progress
                className={styles.segmentProgress}
                max={1}
                value={ended || index < sceneIndex ? 1 : index === sceneIndex ? progress : 0}
              />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.appArea}>
        {!ended && (
          renderScreen
            ? renderScreen(sceneIndex, progress)
            : <MerchantAcademyScreens sceneIndex={sceneIndex} progress={progress} />
        )}

        {!started && (
          <div className={styles.startOverlay}>
            <button type="button" className={styles.startButton} onClick={() => {
              if (!muted) activateMusic();
              setStarted(true);
              setPlaying(true);
            }} aria-label="हिंदी वीडियो चलाएँ">
              <Play size={30} fill="currentColor" aria-hidden="true" />
            </button>
            <strong>वीडियो शुरू करें</strong>
          </div>
        )}

        {ended && (
          <div className={styles.endCard}>
            <CheckCircle2 size={42} aria-hidden="true" />
            <h2>{endTitle}</h2>
            <p>{endText}</p>
            <button type="button" className={styles.replayButton} onClick={replay}>
              <RotateCcw size={18} aria-hidden="true" /> फिर से देखें
            </button>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => {
            if (!started) {
              if (!muted) activateMusic();
              setStarted(true);
              setPlaying(true);
            } else if (playing) {
              setPlaying(false);
              restartCurrentScene();
            } else {
              if (!muted) activateMusic();
              setPlaying(true);
            }
          }}
          disabled={ended}
          aria-label={playing ? "रोकें" : "चलाएँ"}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button type="button" onClick={replay} disabled={!started} aria-label="शुरू से फिर चलाएँ">
          <RotateCcw size={19} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (muted && playing && !ended) activateMusic();
            setMuted((value) => !value);
            if (started && !ended) restartCurrentScene();
          }}
          aria-label={muted ? "आवाज़ चालू करें" : "आवाज़ बंद करें"}
          aria-pressed={muted}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <span className={styles.time}>
          {completed && <CheckCircle2 size={14} aria-label="Watched" />}
          {formatTime(currentTime)} / {formatTime(Math.ceil(total))}
        </span>
      </div>
    </section>
  );
};