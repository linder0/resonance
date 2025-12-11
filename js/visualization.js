// Resonance - Visualization

/**
 * Cache waveform data for efficient rendering
 */
function cacheWaveformData(state, canvasWidth) {
  const cache = { base: null, brain: null, climate: null };

  // Base audio waveform
  if (state.buffer) {
    const data = state.buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvasWidth);
    cache.base = [];
    for (let i = 0; i < canvasWidth; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      cache.base.push({ min, max });
    }
  }

  // Brainwave data
  if (state.brainwave.length > 0) {
    const duration = state.brainwave[state.brainwave.length - 1].time;
    cache.brain = [];
    for (let i = 0; i < canvasWidth; i++) {
      const t = (i / canvasWidth) * duration;
      const sample = interpolateBrainwaveAt(state.brainwave, t);
      cache.brain.push(sample ? (sample.meditation + sample.calmness) / 200 : 0);
    }
  }

  // Climate data
  if (state.climate.length > 0) {
    cache.climate = [];
    for (let i = 0; i < canvasWidth; i++) {
      const idx = Math.floor((i / canvasWidth) * (state.climate.length - 1));
      cache.climate.push(state.climate[idx]?.normalized || 0);
    }
  }

  return cache;
}

function interpolateBrainwaveAt(data, time) {
  if (!data.length) return null;
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i].time <= time && data[i + 1].time > time) {
      const t = (time - data[i].time) / (data[i + 1].time - data[i].time);
      return {
        meditation: data[i].meditation + t * (data[i + 1].meditation - data[i].meditation),
        calmness: data[i].calmness + t * (data[i + 1].calmness - data[i].calmness),
      };
    }
  }
  return data[data.length - 1];
}

/**
 * Render all three tracks
 */
function renderTracks(canvases, cache, playheadX = null) {
  const { base: ctxBase, brain: ctxBrain, climate: ctxClimate } = canvases;
  const W = ctxBase.canvas.width, H = ctxBase.canvas.height;

  // Base track
  ctxBase.fillStyle = '#020203';
  ctxBase.fillRect(0, 0, W, H);
  if (cache.base) {
    ctxBase.fillStyle = '#3a5a5a';
    const cy = H / 2;
    for (let i = 0; i < cache.base.length; i++) {
      const { min, max } = cache.base[i];
      const y1 = cy + min * cy * 0.85;
      const y2 = cy + max * cy * 0.85;
      ctxBase.fillRect(i, y1, 1, y2 - y1 || 1);
    }
  }

  // Brain track
  ctxBrain.fillStyle = '#020203';
  ctxBrain.fillRect(0, 0, W, H);
  if (cache.brain) {
    ctxBrain.strokeStyle = 'rgba(139, 110, 184, 0.4)';
    ctxBrain.lineWidth = 1;
    ctxBrain.beginPath();
    for (let i = 0; i < cache.brain.length; i++) {
      const y = H - cache.brain[i] * H * 0.9;
      i === 0 ? ctxBrain.moveTo(i, y) : ctxBrain.lineTo(i, y);
    }
    ctxBrain.stroke();
    ctxBrain.lineTo(W, H);
    ctxBrain.lineTo(0, H);
    ctxBrain.closePath();
    ctxBrain.fillStyle = 'rgba(139, 110, 184, 0.1)';
    ctxBrain.fill();
  }

  // Climate track
  ctxClimate.fillStyle = '#020203';
  ctxClimate.fillRect(0, 0, W, H);
  if (cache.climate) {
    ctxClimate.strokeStyle = 'rgba(106, 159, 204, 0.4)';
    ctxClimate.lineWidth = 1;
    ctxClimate.beginPath();
    for (let i = 0; i < cache.climate.length; i++) {
      const y = H - cache.climate[i] * H * 0.9;
      i === 0 ? ctxClimate.moveTo(i, y) : ctxClimate.lineTo(i, y);
    }
    ctxClimate.stroke();
    ctxClimate.lineTo(W, H);
    ctxClimate.lineTo(0, H);
    ctxClimate.closePath();
    ctxClimate.fillStyle = 'rgba(106, 159, 204, 0.1)';
    ctxClimate.fill();
  }

  // Playhead
  if (playheadX !== null) {
    const colors = ['#5ab8b8', '#8b6eb8', '#6a9fcc'];
    [ctxBase, ctxBrain, ctxClimate].forEach((ctx, i) => {
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, H);
      ctx.stroke();
    });
  }
}

/**
 * Draw real-time level bars
 */
function drawLevelBars(canvases, playheadX, brainLevel, climateLevel) {
  const { brain: ctxBrain, climate: ctxClimate } = canvases;
  const H = ctxBrain.canvas.height;

  ctxBrain.fillStyle = 'rgba(139, 110, 184, 0.6)';
  ctxBrain.fillRect(playheadX - 2, H - brainLevel * H * 0.9, 4, brainLevel * H * 0.9);

  ctxClimate.fillStyle = 'rgba(106, 159, 204, 0.6)';
  ctxClimate.fillRect(playheadX - 2, H - climateLevel * H * 0.9, 4, climateLevel * H * 0.9);
}

/**
 * Draw oscilloscope overlay
 */
function drawOscilloscope(canvas, analysers) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#020203';
  ctx.fillRect(0, 0, W, H);

  // Center line
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  const colors = ['#5ab8b8', '#8b6eb8', '#6a9fcc'];

  analysers.forEach((analyser, idx) => {
    if (!analyser) return;

    const waveData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(waveData);

    ctx.strokeStyle = colors[idx];
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const cy = H / 2;
    for (let i = 0; i < waveData.length; i++) {
      const x = (i / waveData.length) * W;
      const y = cy + (waveData[i] / 128 - 1) * H * 0.45;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

export { cacheWaveformData, renderTracks, drawLevelBars, drawOscilloscope };
