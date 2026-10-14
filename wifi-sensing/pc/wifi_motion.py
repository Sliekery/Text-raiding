#!/usr/bin/env python3
"""WiFi motion sensor - PC app.

Reads CSI (WiFi channel measurements) streamed by the ESP32 over USB and
decides whether something is moving in the space between the ESP32 and the
router.

Quick start:
    python wifi_motion.py --list-ports
    python wifi_motion.py --port COM3 --plot
    python wifi_motion.py --simulate --plot      # try it without hardware
"""

import argparse
import collections
import csv
import json
import os
import queue
import subprocess
import sys
import threading
import time
from datetime import datetime

import numpy as np

# The ESP32 reports 64 subcarriers in the order 0..31, -32..-1. The DC carrier
# and the guard bands are always empty, so keep the 52 that carry signal,
# reordered from -26 to +26 for display.
SUBCARRIERS = list(range(38, 64)) + list(range(1, 27))
NUM_RAW = 64

DEFAULT_CALIBRATION = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration.json")


# ---------------------------------------------------------------- data sources

class SerialSource:
    """Reads lines from the ESP32 and yields ('csi', rssi, amps) or ('info', text)."""

    def __init__(self, port, baud):
        import serial  # pyserial

        self.ser = serial.Serial(port, baud, timeout=1)

    def items(self):
        while True:
            raw = self.ser.readline()
            if not raw:
                continue
            line = raw.decode("ascii", "replace").strip()
            if line.startswith("CSI,"):
                parts = line.split(",")
                if len(parts) != 3 + NUM_RAW:
                    continue  # partial line, e.g. right after connecting
                try:
                    rssi = int(parts[2])
                    amps = np.array(parts[3:], dtype=float)
                except ValueError:
                    continue
                yield ("csi", rssi, amps)
            elif line.startswith("#"):
                yield ("info", line.lstrip("#").strip())


class SimulatedSource:
    """Fake ESP32: a quiet room with someone walking through now and then."""

    def __init__(self, rate_hz=50, realtime=True, seed=1):
        self.rate = rate_hz
        self.realtime = realtime
        self.rng = np.random.default_rng(seed)

    def items(self):
        rng = self.rng
        k = np.arange(NUM_RAW)
        profile = 40 + 15 * np.sin(k / 7.0) + 8 * np.cos(k / 3.1)  # multipath "fingerprint"
        null = np.zeros(NUM_RAW, bool)
        null[[0, *range(27, 38)]] = True
        yield ("info", "simulation: room is empty for 40 s, then someone walks in every ~25 s")
        n = 0
        while True:
            t = n / self.rate
            gain = 1.0 + 0.15 * (int(t / 13) % 3)  # automatic gain control jumps
            moving = t > 40 and (t - 40) % 25 < 8
            amps = profile * gain
            if moving:
                for f in (0.7, 1.3, 2.1):
                    phase = rng.uniform(0, 0.3) + 2 * np.pi * f * t
                    amps = amps * (1 + 0.06 * np.sin(phase + k * rng.uniform(0.15, 0.25)))
            amps = amps + rng.normal(0, 0.6, NUM_RAW)
            amps[null] = 0
            yield ("csi", -50 + int(rng.integers(-2, 3)), np.clip(np.round(amps), 0, 255))
            n += 1
            if self.realtime:
                time.sleep(1 / self.rate)


def start_reader(source, q):
    def run():
        try:
            for item in source.items():
                q.put(item)
        except Exception as e:  # serial unplugged etc.
            q.put(("error", str(e)))

    threading.Thread(target=run, daemon=True).start()


# ------------------------------------------------------------------- detection

class MotionDetector:
    """Motion score = how much the subcarrier amplitudes fluctuate over a short window.

    Each frame is divided by its mean so the ESP32's automatic gain changes don't
    count as motion. The score is the average (over subcarriers) standard deviation
    across the window, in percent.
    """

    def __init__(self, window_s=1.0):
        self.window_s = window_s
        self.window = collections.deque()

    def add(self, t, amps):
        a = amps[SUBCARRIERS]
        m = a.mean()
        if m < 1:
            return None
        norm = a / m
        self.window.append((t, norm))
        while t - self.window[0][0] > self.window_s:
            self.window.popleft()
        return norm

    def score(self):
        if len(self.window) < 10:
            return None
        arr = np.array([v for _, v in self.window])
        return float(arr.std(axis=0).mean() * 100)


class PresenceState:
    """Turns scores into MOTION / STILL events with a little debouncing."""

    def __init__(self, threshold, hold_s=5.0, trigger_count=3):
        self.threshold = threshold
        self.hold_s = hold_s
        self.trigger_count = trigger_count
        self.motion = False
        self.above = 0
        self.last_above_t = -1e9

    def update(self, t, score):
        if score > self.threshold:
            self.above += 1
            self.last_above_t = t
        else:
            self.above = 0
        if not self.motion and self.above >= self.trigger_count:
            self.motion = True
            return "motion"
        if self.motion and t - self.last_above_t > self.hold_s:
            self.motion = False
            return "still"
        return None


def threshold_from_scores(scores, margin):
    s = np.array(scores)
    median, p99 = float(np.median(s)), float(np.percentile(s, 99))
    return {
        "threshold": p99 * margin,
        "still_median": median,
        "still_p99": p99,
        "margin": margin,
        "created": datetime.now().isoformat(timespec="seconds"),
    }


# ----------------------------------------------------------------------- app

def fmt_now():
    return datetime.now().strftime("%H:%M:%S")


def run_hook(cmd):
    if cmd:
        try:
            subprocess.Popen(cmd, shell=True)
        except OSError as e:
            print(f"\n[{fmt_now()}] hook failed: {e}")


class LivePlot:
    def __init__(self, history_s, rate_hint=50):
        import matplotlib.pyplot as plt

        self.plt = plt
        plt.ion()
        self.fig, (self.ax_heat, self.ax_score) = plt.subplots(
            2, 1, figsize=(10, 7), gridspec_kw={"height_ratios": [2, 1]}
        )
        self.fig.canvas.manager.set_window_title("WiFi motion sensor")
        rows = int(history_s * rate_hint)
        self.frames = collections.deque([np.ones(len(SUBCARRIERS))] * rows, maxlen=rows)
        self.img = self.ax_heat.imshow(
            np.array(self.frames).T, aspect="auto", cmap="viridis", vmin=0.4, vmax=1.6,
            extent=[-history_s, 0, -26, 26], origin="lower",
        )
        self.ax_heat.set_ylabel("subcarrier")
        self.ax_heat.set_title("WiFi signal per subcarrier (normalised)")
        self.fig.colorbar(self.img, ax=self.ax_heat, pad=0.01)
        self.history_s = history_s
        self.score_t = collections.deque()
        self.score_v = collections.deque()
        (self.score_line,) = self.ax_score.plot([], [], color="tab:blue", label="motion score")
        self.thr_line = self.ax_score.axhline(0, color="tab:red", ls="--", label="threshold")
        self.ax_score.set_xlim(-history_s, 0)
        self.ax_score.set_xlabel("seconds")
        self.ax_score.legend(loc="upper left")
        self.fig.tight_layout()
        self.closed = False
        self.fig.canvas.mpl_connect("close_event", lambda e: setattr(self, "closed", True))

    def add_frame(self, norm):
        self.frames.append(norm)

    def add_score(self, t, score):
        self.score_t.append(t)
        self.score_v.append(score)
        while self.score_t and t - self.score_t[0] > self.history_s:
            self.score_t.popleft()
            self.score_v.popleft()

    def draw(self, now, threshold, status):
        self.img.set_data(np.array(self.frames).T)
        ts = np.array(self.score_t) - now
        self.score_line.set_data(ts, self.score_v)
        top = max([threshold or 0, *self.score_v, 0.1]) * 1.3
        self.ax_score.set_ylim(0, top)
        if threshold:
            self.thr_line.set_ydata([threshold, threshold])
        self.ax_score.set_title(status, color="tab:red" if status.startswith("MOTION") else "black")
        self.plt.pause(0.001)


def main():
    p = argparse.ArgumentParser(description="Detect motion from ESP32 WiFi CSI data.")
    p.add_argument("--port", help="serial port of the ESP32, e.g. COM3 or /dev/ttyUSB0")
    p.add_argument("--baud", type=int, default=921600)
    p.add_argument("--list-ports", action="store_true", help="show serial ports and exit")
    p.add_argument("--simulate", action="store_true", help="use fake data (no ESP32 needed)")
    p.add_argument("--plot", action="store_true", help="show a live graph")
    p.add_argument("--calibrate", action="store_true", help="force a new calibration")
    p.add_argument("--calibration-file", default=DEFAULT_CALIBRATION)
    p.add_argument("--calibration-seconds", type=float, default=30)
    p.add_argument("--margin", type=float, default=1.5,
                   help="threshold = still-room noise x margin; lower = more sensitive (default 1.5)")
    p.add_argument("--threshold", type=float, help="set the threshold directly (skips calibration)")
    p.add_argument("--window", type=float, default=1.0, help="analysis window in seconds")
    p.add_argument("--hold", type=float, default=5.0,
                   help="seconds without motion before reporting STILL (default 5)")
    p.add_argument("--log", help="append a CSV log of scores and state to this file")
    p.add_argument("--on-motion", help="shell command to run when motion starts")
    p.add_argument("--on-still", help="shell command to run when motion stops")
    args = p.parse_args()

    if args.list_ports:
        from serial.tools import list_ports

        ports = list(list_ports.comports())
        for port in ports:
            print(f"{port.device:15} {port.description}")
        if not ports:
            print("No serial ports found. Is the ESP32 plugged in (with a data cable)?")
        return

    if args.simulate:
        source = SimulatedSource()
        args.calibration_file = None  # never mix fake data with the real room's calibration
    elif args.port:
        try:
            source = SerialSource(args.port, args.baud)
        except Exception as e:
            print(f"Could not open {args.port}: {e}")
            print("Run with --list-ports to see what is available. Close the Arduino Serial Monitor first.")
            sys.exit(1)
    else:
        p.error("give --port (see --list-ports) or --simulate")

    threshold = args.threshold
    if threshold is None and not args.calibrate and args.calibration_file and os.path.exists(args.calibration_file):
        with open(args.calibration_file) as f:
            cal = json.load(f)
        threshold = cal["still_p99"] * args.margin
        print(f"Loaded calibration from {cal['created']} (threshold {threshold:.3f}). Use --calibrate to redo it.")

    q = queue.Queue()
    start_reader(source, q)

    detector = MotionDetector(args.window)
    state = PresenceState(threshold, args.hold) if threshold is not None else None
    plot = LivePlot(history_s=20) if args.plot else None

    cal_scores = []
    cal_until = None
    if threshold is None:
        print(f"\nCALIBRATING for {args.calibration_seconds:.0f} s: leave the room (or keep completely still).")
        cal_until = time.monotonic() + args.calibration_seconds

    log_writer = None
    if args.log:
        new = not os.path.exists(args.log)
        log_file = open(args.log, "a", newline="")
        log_writer = csv.writer(log_file)
        if new:
            log_writer.writerow(["time", "score", "threshold", "motion"])

    t0 = time.monotonic()
    last_data = t0
    last_draw = 0.0
    last_eval = 0.0
    last_log = 0.0
    frames_in_sec, rate, rate_t = 0, 0.0, t0
    warned_no_data = False

    try:
        while True:
            now = time.monotonic()
            # Drain everything the reader thread collected.
            try:
                while True:
                    item = q.get(timeout=0.02)
                    if item[0] == "csi":
                        norm = detector.add(now, item[2])
                        if norm is not None and plot:
                            plot.add_frame(norm)
                        frames_in_sec += 1
                        last_data = now
                    elif item[0] == "info":
                        print(f"\n[{fmt_now()}] ESP32: {item[1]}")
                    elif item[0] == "error":
                        print(f"\nConnection lost: {item[1]}")
                        return
            except queue.Empty:
                pass

            if now - rate_t >= 1:
                rate, frames_in_sec, rate_t = frames_in_sec / (now - rate_t), 0, now

            if now - last_data > 5 and not warned_no_data:
                warned_no_data = True
                print("\nNo CSI data for 5 s. Check the ESP32 is connected to WiFi "
                      "(open Arduino Serial Monitor at 921600 baud) and that --baud matches.")
            if now - last_data < 1:
                warned_no_data = False

            if now - last_eval < 0.1:
                continue
            last_eval = now
            score = detector.score()
            if score is None:
                continue

            if cal_until is not None:
                cal_scores.append(score)
                left = cal_until - now
                status = f"CALIBRATING {max(left, 0):4.0f}s  score {score:6.3f}"
                if left <= 0:
                    cal = threshold_from_scores(cal_scores, args.margin)
                    threshold = cal["threshold"]
                    state = PresenceState(threshold, args.hold)
                    cal_until = None
                    if args.calibration_file:
                        with open(args.calibration_file, "w") as f:
                            json.dump(cal, f, indent=2)
                    print(f"\n[{fmt_now()}] Calibration done: still-room noise {cal['still_median']:.3f} "
                          f"(99th pct {cal['still_p99']:.3f}), threshold {threshold:.3f}.")
                    if cal["still_p99"] > 3 * cal["still_median"]:
                        print("  Warning: the room didn't look very still. If something moved, run again with --calibrate.")
            else:
                event = state.update(now, score)
                if event == "motion":
                    print(f"\n[{fmt_now()}] MOTION detected (score {score:.3f})")
                    run_hook(args.on_motion)
                elif event == "still":
                    print(f"\n[{fmt_now()}] Still for {args.hold:.0f} s")
                    run_hook(args.on_still)
                label = "MOTION" if state.motion else "still "
                bar_len = 30
                filled = int(min(score / (threshold * 2), 1) * bar_len)
                mark = bar_len // 2
                bar = "".join("#" if i < filled else ("|" if i == mark else "-") for i in range(bar_len))
                status = f"{label}  score {score:6.3f} / {threshold:.3f}  [{bar}]  {rate:3.0f} pkt/s"

                if log_writer and now - last_log >= 1:
                    last_log = now
                    log_writer.writerow([datetime.now().isoformat(timespec="seconds"),
                                         f"{score:.4f}", f"{threshold:.4f}", int(state.motion)])
                    log_file.flush()

            sys.stdout.write("\r" + status + "   ")
            sys.stdout.flush()

            if plot:
                plot.add_score(now, score)
                if now - last_draw > 0.2:
                    last_draw = now
                    plot.draw(now, threshold, status.split("[")[0].strip())
                if plot.closed:
                    break
    except KeyboardInterrupt:
        pass
    print("\nBye.")


if __name__ == "__main__":
    main()
