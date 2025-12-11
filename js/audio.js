// Resonance - Audio Engine

import { getFadeEnvelope, interpolate, normalize, audioBufferToWav } from './utils.js';

/**
 * Create master bus with reverb
 */
function createMasterBus(ctx) {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;

  // Create reverb impulse response
  const reverbTime = 4;
  const reverbLength = ctx.sampleRate * reverbTime;
  const impulse = ctx.createBuffer(2, reverbLength, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < reverbLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-2.5 * i / reverbLength);
    }
  }

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse;

  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.75;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.35;

  masterGain.connect(dryGain);
  masterGain.connect(reverb);
  reverb.connect(wetGain);
  dryGain.connect(ctx.destination);
  wetGain.connect(ctx.destination);

  return masterGain;
}

/**
 * Create overtone oscillators
 */
function createOvertones(ctx, masterGain) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const mix = ctx.createGain();
  mix.connect(analyser);
  analyser.connect(masterGain);

  const oscillators = ['med', 'calm'].map((key, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 136.1 * (i === 0 ? 2 : 3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter).connect(gain).connect(mix);
    osc.start();

    return { osc, filter, gain, key };
  });

  return { oscillators, analyser };
}

/**
 * Create water source
 */
function createWaterSource(ctx, waterBuffer, masterGain) {
  if (!waterBuffer) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  const source = ctx.createBufferSource();
  source.buffer = waterBuffer;
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(gain);
  gain.connect(analyser);
  analyser.connect(masterGain);
  source.start();

  return { source, gain, analyser };
}

/**
 * Render audio to WAV for download
 */
async function renderToWav(state) {
  const duration = state.buffer.duration;
  const sampleRate = state.buffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);

  // Master bus with fade
  const masterGain = offlineCtx.createGain();
  for (let t = 0; t < duration; t += 0.1) {
    masterGain.gain.setValueAtTime(getFadeEnvelope(t, duration), t);
  }

  // Master reverb
  const reverbTime = 4;
  const reverbLength = sampleRate * reverbTime;
  const impulse = offlineCtx.createBuffer(2, reverbLength, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < reverbLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-2.5 * i / reverbLength);
    }
  }

  const reverb = offlineCtx.createConvolver();
  reverb.buffer = impulse;

  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 0.75;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = 0.35;

  masterGain.connect(dryGain);
  masterGain.connect(reverb);
  reverb.connect(wetGain);
  dryGain.connect(offlineCtx.destination);
  wetGain.connect(offlineCtx.destination);

  // Main audio
  const source = offlineCtx.createBufferSource();
  source.buffer = state.buffer;
  const mainGain = offlineCtx.createGain();
  mainGain.gain.value = state.baseEnabled ? 1 : 0;
  source.connect(mainGain);
  mainGain.connect(masterGain);

  // Overtones
  if (state.overtonesEnabled && state.brainwave.length) {
    ['med', 'calm'].forEach((key, i) => {
      const osc = offlineCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 136.1 * (i === 0 ? 2 : 3);
      const gain = offlineCtx.createGain();

      const dataKey = key === 'med' ? 'meditation' : 'calmness';
      for (let t = 0; t < duration; t += 0.1) {
        const sample = interpolate(state.brainwave, t);
        if (sample) {
          const g = normalize(sample[dataKey]) * (state.overtoneLevel / 0.2) * 0.2;
          gain.gain.setValueAtTime(g, t);
        }
      }

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc.stop(duration);
    });
  }

  // Water
  if (state.rippleEnabled && state.waterBuffer && state.climate.length) {
    const waterSource = offlineCtx.createBufferSource();
    waterSource.buffer = state.waterBuffer;
    waterSource.loop = true;
    const waterGain = offlineCtx.createGain();

    for (let t = 0; t < duration; t += 0.1) {
      const progress = t / duration;
      const idx = Math.floor(progress * (state.climate.length - 1));
      const level = state.climate[Math.min(idx, state.climate.length - 1)]?.normalized || 0;
      const vol = (state.rippleLevel / 0.2) * (0.5 + level * 0.5) * 0.1;
      waterGain.gain.setValueAtTime(vol, t);
    }

    waterSource.connect(waterGain);
    waterGain.connect(masterGain);
    waterSource.start();
    waterSource.stop(duration);
  }

  source.start();
  const rendered = await offlineCtx.startRendering();
  return audioBufferToWav(rendered);
}

export { createMasterBus, createOvertones, createWaterSource, renderToWav };
