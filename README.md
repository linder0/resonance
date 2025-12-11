# Resonance

A web-based audio synthesis application that creates immersive soundscapes by combining:

- **Base audio track** — Primary audio foundation
- **Brainwave-driven overtones** — Sine wave oscillators modulated by EEG meditation/calmness data (Muse headband)
- **Climate-driven water ambience** — Environmental sounds modulated by historical climate data

## Features

- Real-time audio visualization with multi-track waveform display
- Oscilloscope overlay showing combined signal
- Individual mix controls for each audio layer
- Fade in/out envelope for smooth playback
- Master reverb for spatial depth
- Download rendered audio as WAV

## Usage

1. Open `index.html` in a modern browser
2. Click ▶ to start playback
3. Toggle individual layers using the Mix buttons
4. Click on any track to seek
5. Download the final mix with the Download WAV button

## Data Files

- `johnhopkins.wav` — Base audio track
- `recording_*.csv` — Brainwave data (meditation, calmness values over time)
- `climatedata.csv` — Historical temperature anomaly data
- `water.mp3` — Water ambience sample

## Project Structure

```
├── index.html          # Main HTML
├── css/
│   └── styles.css      # Styling
├── js/
│   ├── app.js          # Main application logic
│   ├── audio.js        # Audio engine (Web Audio API)
│   ├── data.js         # Data loading and parsing
│   ├── utils.js        # Utility functions
│   └── visualization.js # Canvas rendering
└── [data files]
```

## Technology

Built with vanilla JavaScript using the Web Audio API for real-time synthesis and audio processing.
