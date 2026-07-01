# DEXI flight-controller parameters

QGroundControl-compatible parameter (`.params`) files for [DEXI](https://droneblocks.io)
drones — ready-made configurations you can load onto the flight controller with
QGroundControl (or any tool that reads PX4 `.params`), instead of setting each
parameter by hand.

Files are organized by platform:

| Folder | Platform |
|--------|----------|
| [`dexi-3/`](dexi-3/) | DEXI-3 (H743-AIO flight controller) |
| `dexi-5/` | DEXI-5 (ARK Pi6X) — _coming_ |

> These files are **generated and maintained by DroneBlocks** — please don't
> hand-edit them (edits get overwritten on the next release). Spotted a problem?
> Open an issue.

---

## DEXI-3

### Complete setup — one file per kit

Each kit has a single file bundling its comms + flight tune + flow navigation.

| File | Kit | Contents |
|------|-----|----------|
| [`dexi-3/flight-kit.params`](dexi-3/flight-kit.params) | Flight Kit (Build / Fly) | flow-sensor link + RC + tune + flow nav. No companion. |
| [`dexi-3/developer-kit.params`](dexi-3/developer-kit.params) | Developer Kit (Build / Fly / Code) | everything in Flight Kit **+** companion links (ROS 2 / uXRCE-DDS + MAVLink-over-WiFi / mavlink-router). Needs the Pi image. |

> **Assumes a DEXI-3 already flashed with DEXI-3 firmware and sensor-calibrated.**
> These files set comms, tune, and navigation — they do **not** flash firmware,
> set the airframe (`SYS_AUTOSTART`), calibrate the battery voltage divider, or
> run per-unit accel/gyro/mag calibration. On a built, flashed, calibrated drone,
> load the file and reboot.

### Optional overlays (apply on top)

Only if changing a mode or upgrading — not needed for a fresh setup.

| File | Purpose |
|------|---------|
| [`dexi-3/indoor-apriltag.params`](dexi-3/indoor-apriltag.params) | Switch navigation to AprilTag / external vision (needs a live EV source) |
| [`dexi-3/outdoor-gps.params`](dexi-3/outdoor-gps.params) | Switch to GPS outdoor mode (proposed — needs a GPS+compass module) |
| [`dexi-3/acro-rates.params`](dexi-3/acro-rates.params) | Snappier ACRO max rates (additive tuning) |
| [`dexi-3/developer-comms-addon.params`](dexi-3/developer-comms-addon.params) | Companion links only — upgrade an existing Flight Kit to Developer without redoing tune/nav |
| [`dexi-3/indoor-flow.params`](dexi-3/indoor-flow.params) | Navigation-only flow block — revert to flow from another mode |

[`dexi-3/index.json`](dexi-3/index.json) is a machine-readable manifest (flags complete setups vs overlays).

---

## How to load in QGroundControl

**Vehicle Setup → Parameters → Tools → Load from file** → pick the `.params`.
Then **power-cycle / reboot** the flight controller so the estimator (EKF)
reinitializes — navigation/aiding-source changes need an EKF reset.

These can also be applied from the DroneBlocks web configurator
(**Configure → Profiles**), which sets the params, saves to flash, and reboots in one click.

## Format

Standard QGC/PX4 tab-separated parameters:

```
# MAV  COMP  PARAM          VALUE  TYPE
1      1     EKF2_EV_CTRL   0      6
```

`TYPE`: `6` = INT32, `9` = REAL32. Comment lines (`#`) are ignored on load.

## License

[MIT](LICENSE) © DroneBlocks
