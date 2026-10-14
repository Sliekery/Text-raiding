# WiFi motion sensor (1 × ESP32 + a PC)

Detects movement in a room using only WiFi signals, with no camera.

```
   [ your WiFi router ]  ~~~~~~ room you want to sense ~~~~~~  [ ESP32 ] --USB-- [ PC ]
        replies to pings                                     measures every reply   detects motion
```

The ESP32 joins your WiFi and pings the router about 50 times a second. For each
reply, the ESP32's WiFi chip reports **CSI**: how strongly each of 52
frequency "subcarriers" arrived. When someone moves through the area between the
router and the ESP32, the reflections change and those numbers start to
fluctuate. The PC app measures that fluctuation and reports **MOTION** or **still**.

What it can do: motion and "someone is moving around" detection. What it can't do:
see shapes, identify people, or reliably detect a person sitting perfectly still.

---

## 1. What you need

- **One ESP32 board.** Classic ESP32, ESP32-S2, S3 or C3. (Not the C5/C6; they use a
  different CSI interface.)
- **A USB cable that carries data**, not just power.
- **The second PC** (Windows, macOS or Linux) with **Python 3.9 or newer**. It stays on
  while sensing.
- **2.4 GHz WiFi.** The ESP32 can't use 5 GHz. Most routers broadcast both under one
  name, which is fine.

## 2. Flash the ESP32 (Arduino IDE)

1. Install **Arduino IDE 2** from arduino.cc.
2. *Tools → Board → Boards Manager*: search **esp32** and install **"esp32 by Espressif Systems"**.
3. Open `firmware/csi_sensor/csi_sensor.ino`.
4. At the top, set your WiFi name and password:
   ```cpp
   const char *WIFI_SSID = "YOUR_WIFI_NAME";
   const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
5. *Tools → Board*: pick your board (if unsure, **ESP32 Dev Module**). *Tools → Port*: pick its port.
   - No port shows up? Install the USB driver for your board's chip
     (**CP210x** or **CH340**; the chip name is printed on the board near the USB socket),
     or try another cable.
6. Click **Upload**. If it hangs on "Connecting...", hold the **BOOT** button on the board until uploading starts.
7. Check it works: *Tools → Serial Monitor*, set **921600 baud**. You should see
   ```
   #INFO connected ip=192.168.1.42 gateway=192.168.1.1 channel=6 ...
   CSI,12345,-48,0,0,0,0,0,0,21,23,25,...
   #INFO wifi=connected rssi=-48 channel=6 packets_per_sec=50 dropped=0
   ```
   **Close the Serial Monitor** afterwards, because only one program can use the port at a time.

(PlatformIO users can build from `firmware/` with `pio run -t upload` instead.)

## 3. Place it

The sensed area is roughly the space **between the router and the ESP32**.

- Put the ESP32 so the area you care about (doorway, hallway, living room) is between
  it and the router. A distance of 3–8 m works well; walls in between are OK.
- Raise it about 1 m off the floor, and don't put it right next to the router or behind a TV or a metal cabinet.
- Once placed, don't move it. If you do, re-run the calibration.
- Router in another room? That still works. Moving it 1–2 m can improve results.

## 4. Install and run the PC app

```bash
cd wifi-sensing/pc
pip install -r requirements.txt

python wifi_motion.py --list-ports            # find the ESP32, e.g. COM3 or /dev/ttyUSB0
python wifi_motion.py --port COM3 --plot      # run it with a live graph
```

On first run it **calibrates for 30 seconds**. Leave the room, or keep still, so it can learn
what "empty" looks like. The result is saved to `calibration.json` and reused next time.
Run with `--calibrate` to redo it, for example after moving furniture or the ESP32.

You'll see a live status line:

```
still   score  1.21 / 2.05  [#######--------|--------------]   50 pkt/s
[19:42:07] MOTION detected (score 4.83)
[19:42:31] Still for 5 s
```

With `--plot` you also get a window showing the raw signal per subcarrier (top) and the
motion score against the threshold (bottom). Walk around and watch it react.

**Try it without hardware:** `python wifi_motion.py --simulate --plot`

## 5. Tuning

| Problem | Fix |
|---|---|
| Misses motion | `--margin 1.2` (lower = more sensitive), or move the ESP32 so you walk between it and the router |
| False alarms in an empty room | `--margin 2` and/or re-calibrate with `--calibrate` when the room really is empty |
| Says "still" too quickly or too slowly | `--hold 10` (seconds of calm before reporting still) |
| Jittery | `--window 2` (average over 2 seconds) |

Things that can trigger it in an empty room: fans, pets, curtains moving, robot vacuums,
and someone moving near the router in another room.

## 6. Doing something with it

Run any command when motion starts or stops:

```bash
# Windows: beep
python wifi_motion.py --port COM3 --on-motion "powershell -c [console]::beep(800,300)"

# Log everything to a spreadsheet-friendly file
python wifi_motion.py --port COM3 --log motion_log.csv

# Call a Home Assistant webhook, IFTTT, a phone notification service (e.g. ntfy.sh), ...
python wifi_motion.py --port COM3 --on-motion "curl -d 'Motion in living room' ntfy.sh/your-private-topic"
```

To start it automatically on boot, use Task Scheduler (Windows) or a systemd service or cron `@reboot` (Linux).

## 7. Troubleshooting

- **"still connecting" forever**: wrong WiFi password, or the network is 5 GHz-only or uses
  WPA3-only security. Enable 2.4 GHz and WPA2 (or WPA2/WPA3 mixed) mode on the router.
- **packets_per_sec is much lower than 50**: the router is rate-limiting pings, or the signal is weak.
  20+ is still usable. You can also lower `PACKET_RATE_HZ` in the sketch.
- **"Could not open COM3"**: close the Arduino Serial Monitor or any other program using the port.
- **The ESP32 restarts when the app starts**: that's normal, since opening the port resets it.
  Give it a few seconds to reconnect.
- **Compile error about CSI or ping**: update "esp32 by Espressif Systems" to the latest version in Boards Manager.

## Privacy

Only sense spaces you control, and tell the people you live with that it's running. It
can tell when someone is moving around, which is personal information.

## Ideas for later

- Breathing detection (look at slow 0.1–0.5 Hz oscillations while the room is otherwise still)
- More ESP32s for room-by-room sensing
- MQTT integration with Home Assistant as a native motion sensor
