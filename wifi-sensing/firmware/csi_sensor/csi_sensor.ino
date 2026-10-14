// WiFi motion sensor - ESP32 firmware
//
// The ESP32 joins your home WiFi and pings the router many times per second.
// For every reply it receives, the WiFi chip reports Channel State Information
// (CSI): how strongly each of the 64 OFDM subcarriers arrived. People moving
// between the router and the ESP32 disturb those values. This sketch streams
// the per-subcarrier amplitudes over USB to the PC, which does the detection.
//
// Output (one line per packet, 921600 baud):
//   CSI,<millis>,<rssi>,<amp0>,<amp1>,...,<amp63>
//   #INFO ...   status messages (ignored by the PC app except for display)
//
// Supported boards: ESP32, ESP32-S2, ESP32-S3, ESP32-C3 (2.4 GHz WiFi only).

#include <WiFi.h>
#include "esp_wifi.h"
#include "ping/ping_sock.h"
#include "lwip/ip_addr.h"

#if CONFIG_IDF_TARGET_ESP32C5 || CONFIG_IDF_TARGET_ESP32C6 || CONFIG_IDF_TARGET_ESP32C61
#error "ESP32-C5/C6 use a different CSI API; this sketch supports ESP32, S2, S3 and C3."
#endif

// ======== Settings: edit these ========
const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const uint32_t PACKET_RATE_HZ = 50;   // pings per second (20-100 is sensible)
const uint32_t SERIAL_BAUD = 921600;  // must match --baud in the PC app
// ======================================

static const int NUM_SUBCARRIERS = 64;  // legacy LTF: 64 subcarriers, 2 bytes each

struct CsiFrame {
  uint32_t ms;
  int8_t rssi;
  uint8_t amp[NUM_SUBCARRIERS];
};

static QueueHandle_t csiQueue;
static uint8_t routerMac[6];
static volatile uint32_t framesSeen = 0;
static volatile uint32_t framesDropped = 0;

// Runs inside the WiFi driver task: keep it short, hand the data to loop().
static void onCsi(void *ctx, wifi_csi_info_t *info) {
  if (!info || !info->buf || info->len < NUM_SUBCARRIERS * 2) return;
  if (memcmp(info->mac, routerMac, 6) != 0) return;  // only packets from our router

  CsiFrame f;
  f.ms = millis();
  f.rssi = info->rx_ctrl.rssi;
  for (int i = 0; i < NUM_SUBCARRIERS; i++) {
    int imag = info->buf[2 * i];
    int real = info->buf[2 * i + 1];
    float a = sqrtf((float)(imag * imag + real * real));
    f.amp[i] = a > 255.0f ? 255 : (uint8_t)a;
  }
  framesSeen++;
  if (xQueueSend(csiQueue, &f, 0) != pdTRUE) framesDropped++;
}

static void startCsi() {
  wifi_csi_config_t cfg = {};
  cfg.lltf_en = true;
  cfg.htltf_en = false;
  cfg.stbc_htltf2_en = false;
  cfg.ltf_merge_en = true;
  cfg.channel_filter_en = false;
  cfg.manu_scale = false;
  cfg.shift = 0;
  ESP_ERROR_CHECK(esp_wifi_set_csi_config(&cfg));
  ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(onCsi, nullptr));
  ESP_ERROR_CHECK(esp_wifi_set_csi(true));
}

// Ping the router continuously; each reply produces one CSI measurement.
static void startPing() {
  IPAddress gw = WiFi.gatewayIP();
  esp_ping_config_t pc = ESP_PING_DEFAULT_CONFIG();
  IP_ADDR4(&pc.target_addr, gw[0], gw[1], gw[2], gw[3]);
  pc.count = ESP_PING_COUNT_INFINITE;
  pc.interval_ms = 1000 / PACKET_RATE_HZ;
  pc.timeout_ms = 1000;
  pc.data_size = 1;

  esp_ping_callbacks_t cbs = {};
  esp_ping_handle_t ping;
  ESP_ERROR_CHECK(esp_ping_new_session(&pc, &cbs, &ping));
  ESP_ERROR_CHECK(esp_ping_start(ping));
}

static void printStatus() {
  static uint32_t lastSeen = 0, lastMs = 0;
  uint32_t now = millis();
  float rate = (framesSeen - lastSeen) * 1000.0f / (float)(now - lastMs);
  lastSeen = framesSeen;
  lastMs = now;
  Serial.printf("#INFO wifi=%s rssi=%d channel=%d packets_per_sec=%.0f dropped=%lu\n",
                WiFi.status() == WL_CONNECTED ? "connected" : "DISCONNECTED",
                WiFi.RSSI(), WiFi.channel(), rate, (unsigned long)framesDropped);
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(500);
  csiQueue = xQueueCreate(32, sizeof(CsiFrame));

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // power save would make us miss packets
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("#INFO connecting to \"%s\"...\n", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("#INFO still connecting (check SSID/password; 2.4 GHz only)");
  }
  memcpy(routerMac, WiFi.BSSID(), 6);
  Serial.printf("#INFO connected ip=%s gateway=%s channel=%d router=%s\n",
                WiFi.localIP().toString().c_str(), WiFi.gatewayIP().toString().c_str(),
                WiFi.channel(), WiFi.BSSIDstr().c_str());

  startCsi();
  startPing();
}

void loop() {
  CsiFrame f;
  if (xQueueReceive(csiQueue, &f, pdMS_TO_TICKS(100)) == pdTRUE) {
    char line[24 + NUM_SUBCARRIERS * 4];
    int n = snprintf(line, sizeof(line), "CSI,%lu,%d", (unsigned long)f.ms, f.rssi);
    for (int i = 0; i < NUM_SUBCARRIERS; i++) {
      n += snprintf(line + n, sizeof(line) - n, ",%u", f.amp[i]);
    }
    Serial.println(line);
  }

  static uint32_t lastStatus = 0;
  if (millis() - lastStatus > 5000) {
    lastStatus = millis();
    // Mesh systems can move us to another access point: follow it.
    if (WiFi.status() == WL_CONNECTED) memcpy(routerMac, WiFi.BSSID(), 6);
    printStatus();
  }
}
