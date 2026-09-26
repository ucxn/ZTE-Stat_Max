# ZTE-Stat_HA by 哥哥科技（GBNPA Router Sync）

**English** | [简体中文](../../Readme.md)

*ZTE-Stat_Max* & *GBNPA-Router-Sync* is a network telemetry and multi-endpoint forwarding solution built by **Bro-Tech**.

ZTE Router × Whole-Home Smart Platform Integration — a geeky Home Assistant plugin with a real UI upgrade. The perfect companion for your hardware router's NPU, no firmware flashing required, and it works across the entire ZTE lineup! Device lists laid out flat, full-dashboard visualization at a glance — everything you need is right here, no more flipping between pages…

This custom integration combines script interception with asynchronous Webhook push to feed the router's high-precision traffic data and device states straight into Home Assistant — without disrupting the official topology or triggering ZTE's "single web-session kickout" mechanism. The result: long-term traffic statistics and full situational awareness for network engineers.

Paired with the front-end ScriptCat plugin [Bro-Stat](https://github.com/ucxn/Bro-Stat), it pushes the high-precision traffic data captured in your browser to the Home Assistant hub via Webhook for persistent storage and display.

Whether it's whole-home upload/download totals or a single device's real-time throughput, it's all decoupled and folded into HA's standard device cards. No more constant router-admin logins — get a real-time read on your LAN state from any phone or desktop.

It runs on a passive-receive architecture: HA never polls the router over HTTP, so it stays out of the way of your regular network management.

The project is made up of two components that work together:

**Main project**&emsp;&nbsp;[![Main project](https://img.shields.io/badge/Network-ZTE--Stat__Max-FF4C00?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ucxn/ZTE-Stat_Max)

1. **ZTE-Stat_Max** (a pair of JS scripts): runs in the browser front end, taking over the ZTE router admin panel's data stream and polishing up the local UI.
2. **GBNPA-Router-Sync** (HA integration): runs on your Home Assistant server, handling unlimited multi-endpoint state forwarding and chart logging.

## 📖 Why This Exists

ZTE routers have excellent hardware forwarding performance, but the official web admin panel has some real limitations around multi-device login and data display:

* **Single-session lock**: The stock firmware enforces single-session protection. The moment you log in to the web admin from outside your network (say, over a WireGuard tunnel or a public IP), your always-on local session gets forcibly kicked, and its token dies with it.
* **Buried data**: Real-time device speeds and historical cumulative traffic are tucked away in second- or third-level menus, with no single global list for an intuitive cross-device comparison.

## ✨ Features

* **Local Push architecture**: A one-way, Webhook-based push mechanism. Home Assistant is purely a receiver — no active polling, no API concurrency conflicts, and it follows HA's best-practice data-sync conventions.
* **Dynamic device discovery**: Parses MAC addresses from the data the front-end script uploads and automatically registers a standalone device card in HA for each one.
* **Decoupled read/write, unlimited fan-out**: Breaks past the official admin panel's single-device login limit. HA acts as a message bus broadcasting the data, so multiple users and endpoints can watch concurrently without stepping on each other.
* **High-precision, long-term stats**: Keeps raw bit/byte precision at the core level and plugs straight into HA's Statistics database. The front-end UI leans on HA's rendering engine for smart, adaptive unit conversion (MB/GB).
* **UI grid rework and smart de-duplication**: Follows HA's modern entity-naming convention (`has_entity_name`), automatically handling globally unique IDs and stripping redundant UI card prefixes. Device lists are flattened for a clean, intuitive interface.
* **Offline backflow protection 🛡️**: Built-in dual fault-tolerance logic tells the difference between a data gap caused by network jitter and an actual device traffic reset — preventing the false doubling that the router's 10-minute cycle would otherwise cause.
* **Config Flow support 🖥️**: Native support for HA's modern GUI-based setup — no need to hand-edit `configuration.yaml`. Just plug in and go.

## 🚀 Installation

The system has two parts — the HA receiver and the JS collector. Set them up in order.

### Phase 1: Home Assistant Setup

1. Copy the `custom_components/gbnpa_router` folder from this repo into your Home Assistant's `config/custom_components/` directory, as-is.
2. Restart the Home Assistant service.
3. Go to the HA panel and click **Settings → Devices & Services → Add Integration**.
4. Search for **GBNPA** and add it — the system will automatically initialize and register the Webhook listener port.

> [!TIP]
> ### Installing via HACS
> This method requires HAOS to have decent network access — if that's not the case, just follow the manual steps above instead.
>
> Open Home Assistant, head to the **HACS** panel, click the <kbd>⋮</kbd> in the top right, and choose <img src="https://api.iconify.design/mdi/source-repository.svg?color=%23444444" width="16" align="center"> Custom repositories.
>
> Set **Type** to 🧩 `Integration`, and paste in this address: `ucxn/ZTE-Stat_HA`

### Phase 2: Data Collector Setup

1. Make sure a browser on some 24/7 host (a home server) has the **[ScriptCat](https://scriptcat.org/zh-CN/script-show-page/6676)** extension installed.
2. Import the collector JS script provided in this repo.
3. At the top of the script, point the Webhook URL config at your HA address:
```javascript
const WEBHOOK_URL = "http://[your HA-reachable IP]:8123/api/webhook/gbnpa_router_webhook";
```
4. Log in to the router's web admin panel and leave that tab running in the background — data will start streaming in real time.

## ⚙️ Architecture & Directory Structure

The project's core components:
* `态势感知探针(HA Webhook).user.js`: Runs in the browser front end — handles high-frequency sampling, data cleanup, and JSON packaging.
* `__init__.py`: The HA integration entry point — registers the Webhook, manages the global in-memory dict, and dispatches update signals.
* `sensor.py`: The entity-generation engine — dynamically discovers new nodes on your LAN, creates traffic sensors, and defines the data-protection policy.

## ⚠️ Notes

* This is a purely passive data-listening and reassembly tool — it doesn't touch the ZTE router's underlying firmware and introduces no security risk.
* MAC addresses captured by the script are automatically sanitized at the HA level (colons stripped, lowercased) to match system conventions, though the original formatting is still preserved on the device cards for cross-plugin connection aggregation.
* We'd recommend assigning static IPs to key devices on your router, so their identities show up more reliably on the HA panel.

## 📄 License

[Mozilla Public License - v 2.0](https://www.mozilla.org/MPL/2.0)

Special note: the brother project, **[ZTE-Stat_Max](https://github.com/ucxn/ZTE-Stat_Max)**, remains independent.

---
*Authored by 哥哥科技*
