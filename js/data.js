// Resonance - Data Loading

/**
 * Parse brainwave CSV data
 */
function parseBrainwaveCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  const idx = {
    time: headers.indexOf('time_seconds'),
    med: headers.indexOf('meditation'),
    calm: headers.indexOf('calmness')
  };

  const firstTime = parseFloat(lines[1].split(',')[idx.time]);
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      time: parseFloat(cols[idx.time]) - firstTime,
      meditation: parseFloat(cols[idx.med]),
      calmness: parseFloat(cols[idx.calm]),
    };
  });
}

/**
 * Parse climate CSV data
 */
function parseClimateCSV(text) {
  const lines = text.trim().split('\n');
  const dataLines = lines.filter(l => !l.startsWith('#') && l.includes(','));

  const climate = dataLines.slice(1).map(line => {
    const [year, anomaly] = line.split(',');
    return { year: parseInt(year), anomaly: parseFloat(anomaly) };
  }).filter(d => !isNaN(d.anomaly));

  // Normalize to 0-1 range
  const minAnomaly = Math.min(...climate.map(d => d.anomaly));
  const maxAnomaly = Math.max(...climate.map(d => d.anomaly));
  climate.forEach(d => {
    d.normalized = (d.anomaly - minAnomaly) / (maxAnomaly - minAnomaly);
  });

  return climate;
}

/**
 * Load all required data files
 */
async function loadAllData(audioCtx) {
  const data = {
    buffer: null,
    waterBuffer: null,
    brainwave: [],
    climate: []
  };

  try {
    // Load main audio
    let res = await fetch('johnhopkins.wav');
    if (!res.ok) res = await fetch('backingtrack.wav');
    if (res.ok) {
      data.buffer = await audioCtx.decodeAudioData(await res.arrayBuffer());
      console.log(`Loaded main audio: ${data.buffer.duration.toFixed(1)}s`);
    }

    // Load brainwave CSV
    const csvRes = await fetch('recording_20251209_141007_meditation.csv');
    if (csvRes.ok) {
      data.brainwave = parseBrainwaveCSV(await csvRes.text());
      console.log(`Loaded ${data.brainwave.length} brainwave samples`);
    }

    // Load climate CSV
    const climateRes = await fetch('climatedata.csv');
    if (climateRes.ok) {
      data.climate = parseClimateCSV(await climateRes.text());
      console.log(`Loaded ${data.climate.length} years of climate data`);
    }

    // Load water sample (cache-busted to ensure fresh file)
    const waterRes = await fetch('water.mp3?v=' + Date.now());
    if (waterRes.ok) {
      data.waterBuffer = await audioCtx.decodeAudioData(await waterRes.arrayBuffer());
      console.log(`Loaded water.mp3: ${data.waterBuffer.duration.toFixed(1)}s`);
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }

  return data;
}

export { parseBrainwaveCSV, parseClimateCSV, loadAllData };
