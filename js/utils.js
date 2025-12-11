// Resonance - Utility Functions

const FADE_DURATION = 30; // seconds

/**
 * Calculate fade envelope (0 to 1) based on playback time
 */
function getFadeEnvelope(time, duration) {
  if (duration <= 0) return 1;

  let fadeMultiplier = 1;

  // Fade in (first 30 seconds)
  if (time < FADE_DURATION) {
    fadeMultiplier = 0.5 * (1 - Math.cos(Math.PI * time / FADE_DURATION));
  }

  // Fade out (last 30 seconds)
  const timeFromEnd = duration - time;
  if (timeFromEnd < FADE_DURATION) {
    const fadeOut = 0.5 * (1 + Math.cos(Math.PI * (1 - timeFromEnd / FADE_DURATION)));
    fadeMultiplier = Math.min(fadeMultiplier, fadeOut);
  }

  return fadeMultiplier;
}

/**
 * Interpolate brainwave data at a given time
 */
function interpolate(data, time) {
  if (!data.length) return null;
  let prev = data[0], next = data[data.length - 1];
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i].time <= time && data[i + 1].time > time) {
      prev = data[i]; next = data[i + 1]; break;
    }
  }
  const t = next.time !== prev.time ? (time - prev.time) / (next.time - prev.time) : 0;
  return {
    meditation: prev.meditation + t * (next.meditation - prev.meditation),
    calmness: prev.calmness + t * (next.calmness - prev.calmness),
  };
}

/**
 * Normalize value to 0-1 range (Muse headband uses 0-100)
 */
function normalize(val) {
  return Math.max(0, Math.min(1, val / 100));
}

/**
 * Format seconds as MM:SS
 */
function formatTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave channels
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export { FADE_DURATION, getFadeEnvelope, interpolate, normalize, formatTime, audioBufferToWav };
