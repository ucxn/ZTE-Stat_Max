# ZTE-Stat_Max

[![Version](https://img.shields.io/badge/version-5.7-orange.svg)](https://github.com/YourName/ZTE-Dashboard_Max)
[![License: GPL 3.0](https://img.shields.io/badge/License-GPL_3.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Platform](https://img.shields.io/badge/platform-Tampermonkey-green.svg)](https://www.tampermonkey.net/)

**English** | [简体中文](README.md)

**ZTE-Stat_Max** is a Tampermonkey enhancement script specifically designed for the ZTE router Web UI management dashboard.

By taking over the underlying XML API data stream of the native Vue framework, this script reconstructs the UI layout of the "Network Management" and "Connected Devices" pages without breaking the official topology and structure. It introduces trapezoidal integration algorithms, an abnormal traffic radar, and a dual-track traffic alignment display, providing an dashboard for network engineers and power users.

A Web UI enhancement plugin for ZTE routers. Verified compatible with: Nebula MAX Whole-House 2.5G Wired Main Router / BE 5100Pro+! Separately tracks uplink and downlink traffic, displays traffic ratio and up/down proportions, and combats P2P/PCDN upstream theft. Supports both 1000/1024 base systems and Mbps/GiB units. Enables global comparison between LAN and WAN traffic! Features a flattened device list for instant big-screen visualization. Everything you need is right here—no more tedious menu switching...

While the official Web dashboard is stable, its UX design for data visualization has some friction. For instance, real-time network speeds and historical accumulated traffic for devices are hidden behind secondary menus. You have to frequently click into specific devices to view them, making it impossible to form an intuitive, global comparison. The core purpose of this plugin is to "flatten" these hierarchies. It extracts the up/down network speeds of individual devices, the integrated traffic during the current session, and the underlying total accumulated throughput, pushing them all to the forefront of the main device list. Without any extra clicks, the network throughput status of all devices is clear at a glance.

## ✨ Features

* **Traffic & Ratio Statistics**: Tracks the uplink and downlink traffic of individual devices separately, allowing you to view real-time traffic ratio rates and up/down proportions.
* **Abnormal Upload Monitoring**: Detects up/down ratios and visually flags abnormal uploads, combating PCDN / P2P bandwidth theft.
* **Precise Unit Conversion**: Strictly differentiates between network transmission rates and storage capacity. Supports both 1000/1024 base systems and displays in Mbps / GiB.
* **Global Data Comparison**: Supports aggregate statistics and intuitive comparison between the internal network (LAN algebraic sum) and the public network (WAN port).
* **High-Precision Integral Traffic Tracking ⏱️ & UI Grid Refactoring 🖥️**
* **Dual-Track Traffic Comparison**: In addition to displaying the historical total throughput natively provided by the router interface, the frontend independently conducts high-frequency data sampling to track the actual traffic consumed while the page is open. Both metrics are displayed side-by-side for reference. Units are unified to the current session, focusing on the observability of changes.
* **Customization Support**: Respects network engineering habits by allowing script variables to customize display logic for Base-1000 (Mbps) and Base-1024 (MiB/s).
* **🛡️ Privacy Protection & UI Optimization**:
  * Automatically masks sensitive MAC addresses and temporary IPv6 addresses during in-place DOM mutation rendering, ensuring safety when screen recording, capturing, or sharing network status.
  * Employs a forced bottom-alignment system based on Flexbox, fixing height discrepancies caused by CSS grids.
  * Trace-less injection. Does not break the native Vue state machine, ensuring browser rendering performance.

## 📸 Screenshots

| Xiaomi Reference | ZTE Original | Enhanced Version |
| :---: | :---: | :---: |
| ![Xiaomi Reference](./assets/Mi.png) | ![ZTE Original](./assets/ZTE.png) | ![Enhanced Version](./assets/me.png) |

## 🚀 Installation Guide

### Requirements
Before using this script, ensure your browser has a user script manager extension installed, such as:
* **[Tampermonkey](https://www.tampermonkey.net/)** (Recommended, supports Chrome, Edge, Firefox, Safari)
* **[Violentmonkey](https://violentmonkey.github.io/)**

### Script Installation
1. Click here to install the full version of the script: **[Install ZTE-Stat_Max](https://github.com/ucxn/ZTE-Stat_Max/raw/refs/heads/main/new.js)**
2. Click **"Install"** or **"Update"** in the Tampermonkey popup interface.
3. Log into your ZTE router's Web management dashboard, *enter your admin password*, and upon successful login, *refresh the page* and navigate to the "Network Management" or "Connected Devices" page. The script will activate automatically.

## ⚙️ Configuration

The script exposes a global `CONFIG` object at the top, allowing users to fine-tune it according to their specific network environment:

```javascript
const CONFIG = {
    calcMode: 1,            // 1: Absolute multiplier mode (Uplink/Downlink), 0: Traditional percentage mode
    ratioExtremeUp: 10,     // Extreme upload trigger threshold (default > 1000%, triggers red ⚠️ alert)
    ratioWarnUp: 0.07,      // Heavy upload trigger threshold (default > 7%, triggers red highlight)
    ratioExtremeDown: 0.01, // Extreme download trigger threshold (default < 1%, triggers blue download multiplier display)
    
    // Chinese mapping dictionary for physical ports and wireless bands (can be customized based on your router model)
    portMap: {
        "eth1": "Port 1",
        "eth2": "Port 2",
        "eth3": "Port 3",
        "eth4": "Port 4",
        "wl0":  "Wi-Fi 2.4G",
        "wl1":  "Wi-Fi 5.2G",
        "wl2":  "Wi-Fi 5.8G"
    }
};
```

## ⚠️ Notes

* This script only reformats and calculates the fetched API data on the frontend; it will not modify the router's underlying core configuration.
* If your router's management address is a non-standard IP, please manually add it to the `@match` or `@include` header rules in the script.
* This script is a pure frontend DOM injection and data reorganization tool. It does not involve modifying the ZTE router's underlying firmware.

Utilizing the Tampermonkey environment, the script makes concurrent requests to the router's `vue_home_device_data_no_update_sess` and `vue_client_data` APIs. To eliminate the lag caused by the official frontend's polling refresh, the script internally implements an independent timer via `performance.now()`, deriving highly accurate instantaneous traffic data. All UI modifications are executed via DOM Mutation on top of the original page's CSS framework, ensuring a native feel and seamless compatibility.

## 📄 License

[GNU-GPL 3.0](https://www.gnu.org/licenses/gpl-3.0.html)

---
*Authored by Brother Tech*
