#!/usr/bin/env python3
"""
HAM Radio / ISS Cross-Repeater WebSDR Transcription Tool
=========================================================
Transcribes WAV or MP3 recordings from WebSDR clients.
Handles noisy RF audio, squelch tails, and screeches common in HAM radio recordings.

Requirements:
    pip install openai-whisper pydub numpy scipy soundfile torch
    # For MP3 support: also install ffmpeg (system package)
    #   Ubuntu/Debian: sudo apt install ffmpeg
    #   macOS:         brew install ffmpeg
    #   Windows:       https://ffmpeg.org/download.html

Usage:
    python transcribe_ham.py input.wav
    python transcribe_ham.py input.mp3
    python transcribe_ham.py input.mp3 --output my_transcript.txt
    python transcribe_ham.py input.wav --model medium --no-filter
"""

import argparse
import sys
import os
import warnings
warnings.filterwarnings("ignore")

def check_dependencies():
    missing = []
    try:
        import whisper
    except ImportError:
        missing.append("openai-whisper")
    try:
        import pydub
    except ImportError:
        missing.append("pydub")
    try:
        import numpy
    except ImportError:
        missing.append("numpy")
    try:
        import scipy
    except ImportError:
        missing.append("scipy")
    try:
        import soundfile
    except ImportError:
        missing.append("soundfile")
    if missing:
        print(f"[ERROR] Missing dependencies: {', '.join(missing)}")
        print(f"  Install with: pip install {' '.join(missing)}")
        sys.exit(1)

check_dependencies()

import numpy as np
import soundfile as sf
import whisper
from scipy import signal
from pydub import AudioSegment
import tempfile


# ── Audio Preprocessing ──────────────────────────────────────────────────────

def load_audio(path: str) -> tuple[np.ndarray, int]:
    """Load WAV or MP3, return mono float32 array and sample rate."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".mp3":
        audio = AudioSegment.from_mp3(path)
        audio = audio.set_channels(1).set_frame_rate(16000)
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        samples /= np.iinfo(audio.array_type).max
        return samples, 16000
    else:
        samples, sr = sf.read(path, dtype="float32", always_2d=False)
        if samples.ndim == 2:
            samples = samples.mean(axis=1)          # stereo → mono
        return samples, sr


def resample(samples: np.ndarray, orig_sr: int, target_sr: int = 16000) -> np.ndarray:
    if orig_sr == target_sr:
        return samples
    ratio = target_sr / orig_sr
    new_len = int(len(samples) * ratio)
    return signal.resample(samples, new_len)


def bandpass_filter(samples: np.ndarray, sr: int,
                    low_hz: float = 300.0, high_hz: float = 3400.0) -> np.ndarray:
    """
    Telephone-band bandpass filter.
    HAM voice sits between ~300 Hz – 3400 Hz (standard SSB/FM audio bandwidth).
    This aggressively cuts screeches, squelch tails, and RF noise outside voice band.
    """
    nyq = sr / 2.0
    low  = max(low_hz  / nyq, 1e-4)
    high = min(high_hz / nyq, 0.9999)
    b, a = signal.butter(6, [low, high], btype="band")
    return signal.filtfilt(b, a, samples).astype(np.float32)


def spectral_gate(samples: np.ndarray, sr: int,
                  threshold_db: float = -35.0,
                  frame_ms: int = 25) -> np.ndarray:
    """
    Simple spectral / noise gate.
    Silence frames whose RMS energy is below threshold_db relative to peak.
    This removes squelch tails, carrier noise, and other constant-level interference.
    """
    frame_len = int(sr * frame_ms / 1000)
    peak_rms  = 0.0
    rms_vals  = []

    # first pass – compute RMS per frame
    for i in range(0, len(samples) - frame_len, frame_len):
        rms = np.sqrt(np.mean(samples[i:i+frame_len] ** 2))
        rms_vals.append(rms)
        if rms > peak_rms:
            peak_rms = rms

    if peak_rms == 0:
        return samples

    threshold_linear = peak_rms * (10 ** (threshold_db / 20))
    out = samples.copy()

    for idx, i in enumerate(range(0, len(samples) - frame_len, frame_len)):
        if idx < len(rms_vals) and rms_vals[idx] < threshold_linear:
            out[i:i+frame_len] = 0.0

    return out


def normalize(samples: np.ndarray) -> np.ndarray:
    peak = np.abs(samples).max()
    if peak > 0:
        samples = samples / peak * 0.95
    return samples


def preprocess(samples: np.ndarray, sr: int, apply_filter: bool = True) -> tuple[np.ndarray, int]:
    samples = resample(samples, sr, 16000)
    sr = 16000
    if apply_filter:
        samples = bandpass_filter(samples, sr)
        samples = spectral_gate(samples, sr)
    samples = normalize(samples)
    return samples, sr


# ── Transcription ─────────────────────────────────────────────────────────────

WHISPER_PROMPT = (
    "This is a HAM radio recording from an ISS cross-band repeater via WebSDR. "
    "Audio contains callsigns (e.g. W1AW, K6RPT, NA1SS), voice transmissions, "
    "squelch tails, noise bursts, and DTMF tones. Transcribe only spoken words."
)


def transcribe(audio_path: str,
               model_name: str = "base",
               apply_filter: bool = True,
               language: str = "en") -> dict:
    print(f"[+] Loading audio: {audio_path}")
    samples, sr = load_audio(audio_path)
    print(f"    Duration : {len(samples)/sr:.1f}s  |  Sample rate: {sr} Hz")

    if apply_filter:
        print("[+] Preprocessing audio (bandpass filter + noise gate)...")
        samples, sr = preprocess(samples, sr, apply_filter=True)
    else:
        samples, sr = preprocess(samples, sr, apply_filter=False)

    # Write cleaned audio to a temp WAV so Whisper can read it
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
    sf.write(tmp_path, samples, sr)

    print(f"[+] Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name)

    print("[+] Transcribing...")
    result = model.transcribe(
        tmp_path,
        language=language,
        initial_prompt=WHISPER_PROMPT,
        verbose=False,
        condition_on_previous_text=True,
        temperature=0.0,           # deterministic – better for sparse HAM audio
        no_speech_threshold=0.6,   # higher = skip more noise-only frames
        logprob_threshold=-1.0,
        compression_ratio_threshold=2.4,
        word_timestamps=True,
    )
    os.unlink(tmp_path)
    return result


# ── Output Formatting ─────────────────────────────────────────────────────────

def format_transcript(result: dict, source_file: str) -> str:
    lines = []
    lines.append(f"# HAM Radio / ISS WebSDR Transcription")
    lines.append(f"# Source : {os.path.basename(source_file)}")
    lines.append(f"# Model  : Whisper")
    lines.append(f"# Language detected: {result.get('language', 'unknown')}")
    lines.append("")
    lines.append("=" * 60)
    lines.append("")

    for seg in result.get("segments", []):
        start = seg["start"]
        end   = seg["end"]
        text  = seg["text"].strip()
        if not text:
            continue
        ts = f"[{_fmt_time(start)} --> {_fmt_time(end)}]"
        lines.append(f"{ts}  {text}")

    lines.append("")
    lines.append("=" * 60)
    lines.append("# Full text (no timestamps):")
    lines.append("")
    lines.append(result.get("text", "").strip())
    return "\n".join(lines)


def _fmt_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    ms    = int((seconds - int(seconds)) * 1000)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"
    return f"{m:02d}:{s:02d}.{ms:03d}"


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Transcribe HAM radio / ISS WebSDR recordings (WAV or MP3)."
    )
    parser.add_argument("input", help="Path to input .wav or .mp3 file")
    parser.add_argument(
        "--output", "-o",
        help="Output .txt file path (default: same name as input with .txt)"
    )
    parser.add_argument(
        "--model", "-m",
        default="base",
        choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
        help="Whisper model size (default: base). Use 'medium' or 'large' for best accuracy."
    )
    parser.add_argument(
        "--no-filter",
        action="store_true",
        help="Skip bandpass filter and noise gate (use raw audio)"
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Language code (default: en). Use 'auto' to let Whisper detect."
    )
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print(f"[ERROR] File not found: {args.input}")
        sys.exit(1)

    ext = os.path.splitext(args.input)[1].lower()
    if ext not in (".wav", ".mp3"):
        print(f"[ERROR] Unsupported file type '{ext}'. Only .wav and .mp3 are supported.")
        sys.exit(1)

    output_path = args.output or os.path.splitext(args.input)[0] + "_transcript.txt"
    language    = None if args.language == "auto" else args.language

    result = transcribe(
        audio_path    = args.input,
        model_name    = args.model,
        apply_filter  = not args.no_filter,
        language      = language,
    )

    transcript = format_transcript(result, args.input)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(transcript)

    print(f"\n[✓] Transcription saved to: {output_path}")
    print("\n── Preview ──────────────────────────────────────")
    preview_lines = [l for l in transcript.splitlines() if l.strip() and not l.startswith("#")]
    print("\n".join(preview_lines[:20]))
    if len(preview_lines) > 20:
        print(f"  ... ({len(preview_lines)-20} more lines in file)")


if __name__ == "__main__":
    main()