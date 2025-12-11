// Resonance - Main Application

import { loadAllData } from './data.js';
import { createMasterBus, createOvertones, createWaterSource, renderToWav } from './audio.js';
import { cacheWaveformData, renderTracks, drawLevelBars, drawOscilloscope } from './visualization.js';
import { getFadeEnvelope, interpolate, normalize, formatTime } from './utils.js';

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Application state
const state = {
  playing: false,
  startTime: 0,
  seekTime: 0,
  buffer: null,
  waterBuffer: null,
  brainwave: [],
  climate: [],
  smoothed: { med: 0, calm: 0 },
  overtoneLevel: 0.15,
  rippleLevel: 0.15,
  trackLevel: 0,
  climateLevel: 0,
  baseEnabled: true,
  overtonesEnabled: true,
  rippleEnabled: true,
};

let nodes = {};
let waveformCache = { base: null, brain: null, climate: null };

// Canvas contexts
const canvases = {
  base: document.getElementById('trackBase').getContext('2d'),
  brain: document.getElementById('trackBrain').getContext('2d'),
  climate: document.getElementById('trackClimate').getContext('2d'),
};
const scopeCanvas = document.getElementById('scopeOverlay');

// DOM elements
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const timeDisplay = document.getElementById('time');
const levelOvertones = document.getElementById('levelOvertones');
const levelWater = document.getElementById('levelWater');
const downloadBtn = document.getElementById('downloadBtn');

// Toggle handlers
document.getElementById('baseToggle').onclick = () => {
  state.baseEnabled = !state.baseEnabled;
  document.getElementById('baseToggle').classList.toggle('on', state.baseEnabled);
  if (nodes.mainGain) {
    nodes.mainGain.gain.setTargetAtTime(state.baseEnabled ? 1 : 0, audioCtx.currentTime, 0.1);
  }
};

document.getElementById('overtonesToggle').onclick = () => {
  state.overtonesEnabled = !state.overtonesEnabled;
  document.getElementById('overtonesToggle').classList.toggle('on', state.overtonesEnabled);
};

document.getElementById('rippleToggle').onclick = () => {
  state.rippleEnabled = !state.rippleEnabled;
  document.getElementById('rippleToggle').classList.toggle('on', state.rippleEnabled);
};

// Playback controls
function play() {
  playFrom(state.seekTime || 0);
}

function stop() {
  if (!state.playing) return;
  nodes.source?.stop();
  nodes.overtones?.oscillators.forEach(o => o.osc.stop());
  nodes.water?.source.stop();
  nodes = {};
  state.playing = false;
  state.smoothed = { med: 0, calm: 0 };
  state.trackLevel = 0;
  state.climateLevel = 0;
  playBtn.classList.remove('active');
  renderTracks(canvases, waveformCache);
  scopeCanvas.getContext('2d').clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);
}

function playFrom(startTime) {
  if (!state.buffer || state.playing) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  state.seekTime = startTime || 0;

  // Create audio graph
  const masterGain = createMasterBus(audioCtx);

  const source = audioCtx.createBufferSource();
  source.buffer = state.buffer;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;

  const mainGain = audioCtx.createGain();
  mainGain.gain.value = state.baseEnabled ? 1.0 : 0;

  source.connect(analyser);
  analyser.connect(mainGain);
  mainGain.connect(masterGain);

  const overtones = createOvertones(audioCtx, masterGain);
  const water = createWaterSource(audioCtx, state.waterBuffer, masterGain);

  nodes = {
    source,
    mainGain,
    masterGain,
    analyser,
    overtones,
    water,
  };

  source.start(0, startTime);
  state.startTime = audioCtx.currentTime - startTime;
  state.playing = true;
  playBtn.classList.add('active');
  source.onended = stop;
  animate();
}

function animate() {
  if (!state.playing) return;

  const time = audioCtx.currentTime - state.startTime;
  timeDisplay.textContent = `${formatTime(time)} / ${formatTime(state.buffer.duration)}`;

  const fadeEnvelope = getFadeEnvelope(time, state.buffer.duration);

  // Apply master fade
  if (nodes.masterGain) {
    nodes.masterGain.gain.setTargetAtTime(fadeEnvelope, audioCtx.currentTime, 0.5);
  }

  // Analyze track level (RMS)
  if (nodes.analyser) {
    const tempData = new Float32Array(nodes.analyser.fftSize);
    nodes.analyser.getFloatTimeDomainData(tempData);
    let rms = 0;
    for (let i = 0; i < tempData.length; i++) rms += tempData[i] * tempData[i];
    rms = Math.sqrt(rms / tempData.length);
    state.trackLevel = state.trackLevel * 0.85 + Math.min(1, rms * 6) * 0.15;
  }

  // Update overtones
  if (state.brainwave.length && nodes.overtones) {
    const sample = interpolate(state.brainwave, time);
    if (sample) {
      ['med', 'calm'].forEach((key, i) => {
        const dataKey = key === 'med' ? 'meditation' : 'calmness';
        const norm = normalize(sample[dataKey]);
        state.smoothed[key] = state.smoothed[key] * 0.9 + norm * 0.1;

        const ot = nodes.overtones.oscillators[i];
        // Fade is applied through masterGain, so don't apply it here
        const gain = state.overtonesEnabled
          ? state.smoothed[key] * (state.overtoneLevel / 0.2) * Math.max(0.2, state.trackLevel) * 0.2
          : 0;
        ot.gain.gain.setTargetAtTime(gain, audioCtx.currentTime, 0.3);
      });
    }
  }

  // Update water
  if (state.climate.length > 0 && nodes.water) {
    const progress = time / state.buffer.duration;
    const idx = Math.floor(progress * (state.climate.length - 1));
    const climateData = state.climate[Math.min(idx, state.climate.length - 1)];
    state.climateLevel = state.climateLevel * 0.95 + climateData.normalized * 0.05;

    if (state.rippleEnabled) {
      const vol = (state.rippleLevel / 0.2) * (0.5 + state.climateLevel * 0.5) * 0.1;
      nodes.water.gain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.3);
    } else {
      nodes.water.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
    }
  }

  // Update level meters
  levelOvertones.style.width = (state.overtonesEnabled ? (state.smoothed.med + state.smoothed.calm) / 2 * 100 : 0) + '%';
  levelWater.style.width = (state.rippleEnabled ? state.climateLevel * 100 : 0) + '%';

  // Draw visualization
  const W = canvases.base.canvas.width;
  const playheadX = (time / state.buffer.duration) * W;
  renderTracks(canvases, waveformCache, playheadX);
  drawLevelBars(canvases, playheadX, (state.smoothed.med + state.smoothed.calm) / 2, state.climateLevel);
  drawOscilloscope(scopeCanvas, [nodes.analyser, nodes.overtones?.analyser, nodes.water?.analyser]);

  requestAnimationFrame(animate);
}

// Seek functionality
function setupSeek(canvas) {
  canvas.style.cursor = 'pointer';
  canvas.addEventListener('click', (e) => {
    if (!state.buffer) return;
    const rect = canvas.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seekTime = pct * state.buffer.duration;

    const wasPlaying = state.playing;
    if (wasPlaying) {
      nodes.source?.stop();
      nodes.overtones?.oscillators.forEach(o => o.osc.stop());
      nodes.water?.source.stop();
    }
    state.playing = false;

    if (wasPlaying) {
      playFrom(seekTime);
    } else {
      state.seekTime = seekTime;
      const playheadX = pct * canvas.width;
      renderTracks(canvases, waveformCache, playheadX);
    }
  });
}

// Download handler
downloadBtn.onclick = async () => {
  if (!state.buffer) return alert('No audio loaded');

  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Rendering...';

  try {
    const wavBlob = await renderToWav(state);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resonance_output.wav';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert('Error rendering audio');
  }

  downloadBtn.disabled = false;
  downloadBtn.textContent = '⬇ Download WAV';
};

// Initialize
async function init() {
  playBtn.onclick = play;
  stopBtn.onclick = stop;

  setupSeek(document.getElementById('trackBase'));
  setupSeek(document.getElementById('trackBrain'));
  setupSeek(document.getElementById('trackClimate'));

  renderTracks(canvases, waveformCache);

  // Load data
  const data = await loadAllData(audioCtx);
  Object.assign(state, data);

  if (state.buffer) {
    timeDisplay.textContent = `00:00 / ${formatTime(state.buffer.duration)}`;
    waveformCache = cacheWaveformData(state, canvases.base.canvas.width);
    renderTracks(canvases, waveformCache);
  }
}

init();
