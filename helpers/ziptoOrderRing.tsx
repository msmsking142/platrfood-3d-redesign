const masterChains = new WeakMap<AudioContext, GainNode>();

function getMasterChain(context: AudioContext): GainNode {
  const existing = masterChains.get(context);
  if (existing) return existing;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 4;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.1;

  const master = context.createGain();
  master.gain.value = 1;
  compressor.connect(master);
  master.connect(context.destination);
  masterChains.set(context, master);

  return master;
}

function scheduleVoice(
  context: AudioContext,
  output: GainNode,
  frequency: number,
  type: OscillatorType,
  start: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const duration = 0.4;
  const step = 0.025;
  const ramp = 0.005;

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(output);

  gain.gain.setValueAtTime(0.0001, start);
  for (let index = 0; index < duration / step; index += 1) {
    const time = start + index * step;
    const level = index % 2 === 0 ? 0.6 : 0.0001;
    gain.gain.setValueAtTime(index % 2 === 0 ? 0.0001 : 0.6, time);
    gain.gain.linearRampToValueAtTime(level, time + ramp);
  }
  gain.gain.setValueAtTime(0.0001, start + duration - ramp);

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

export function scheduleOrderRing(context: AudioContext): boolean {
  const output = getMasterChain(context);
  const start = context.currentTime;

  // Three 400ms bursts with 200ms gaps fill a 1.6s ring cycle.
  for (const offset of [0, 0.6, 1.2]) {
    scheduleVoice(context, output, 880, "square", start + offset);
    scheduleVoice(context, output, 1320, "triangle", start + offset);
  }

  return true;
}