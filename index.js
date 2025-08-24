// Addresses use Modbus TCP 0-based indexing:
// 0 => 40001 Level% (0..100, int)
// 20 => 40021 InletValveCmd (0..100, written by vPLC)
// 21 => 40022 OutletValveCmd (0..100, written by vPLC)

// (Optional) Input Register for status:
// IR 0 => 30001 Status: 1=OK, 2=>90% high, 3=Broken (>100%)

import ModbusRTU from "modbus-serial"; // which can be used for TCP because it includes tcp lib as well

// ── Sim parameters (tune via env if you like) ───────────────────────────────
const TICK_MS = parseInt(process.env.TICK_MS || "100", 10); // 100 ms
const K_IN = parseFloat(process.env.K_IN || "20"); // %/s at inlet=100
const K_OUT_MIN = parseFloat(process.env.K_OUT_MIN || "2"); // %/s always drains
const K_OUT_MAX = parseFloat(process.env.K_OUT_MAX || "15"); // %/s extra at outlet=100
// With defaults: if both valves = 100, net = 20 - (2+15) = +3 %/s (fills up)

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "502", 10); //
const UNIT = parseInt(process.env.UNIT || "1", 10);

// ── State ───────────────────────────────────────────────────────────────────
let level = 0; // 0..100 (%), integer for simplicity
let inletCmd = 0; // 0..100 (written by vPLC)
let outletCmd = 0; // 0..100 (written by vPLC)
let status = 1; // 1=OK, 2=>90% high, 3=Broken
let broken = false; // if true, tank is broken and level stops updating

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function step(dtSec) {
  if (broken) return; // tank is broken; freeze at current level

  // Simple flow model (units are abstract; they translate to %/s gains):
  const inflow = K_IN * (inletCmd / 100);
  const outflow = K_OUT_MIN + K_OUT_MAX * (outletCmd / 100);
  const dLevel = (inflow - outflow) * dtSec; // % change over dt

  level = clamp(level + dLevel, 0, 110); // allow slight overshoot to detect >100

  // Status: high warning and break rule
  if (level > 100) {
    broken = true;
    status = 3;
    level = 100;
  } else if (level > 90) {
    status = 2;
  } else {
    status = 1;
  }
}

// ── Modbus ServerTCP (modbus-serial library) ────────────────────────────────────────
const vector = {
  // Holding Registers (FC3/FC6/FC16) — 0-based addresses
  getHoldingRegister: (addr) => {
    switch (addr) {
      case 0:
        return Math.round(level); // 40001
      case 20:
        return clamp(inletCmd | 0, 0, 100); // 40021
      case 21:
        return clamp(outletCmd | 0, 0, 100); // 40022
      default:
        return 0;
    }
  },
  setRegister: (addr, value) => {
    const v = clamp(value | 0, 0, 100);
    switch (addr) {
      case 0:
        /* 40001 is RO by spec — ignore writes */ break;
      case 20:
        inletCmd = v;
        break; // 40021
      case 21:
        outletCmd = v;
        break; // 40022
      default: /* ignore */
    }
  },

  // Input Registers (FC4) — optional status for your HMI/diagnostics
  getInputRegister: (addr) => {
    switch (addr) {
      case 0:
        return status; // 30001
      default:
        return 0;
    }
  },

  // Coils/Discrete Inputs not used in the minimal spec. **It can be added later**
  getCoil: () => 0,
  setCoil: () => {},
  getDiscreteInput: () => 0,
};

const server = new ModbusRTU.ServerTCP(vector, {
  host: HOST,
  port: PORT,
  unitID: UNIT,
});

server.on("socketError", (e) =>
  console.error("Modbus socket error:", e.message)
);
console.log(`TankSim Modbus-TCP listening on ${HOST}:${PORT} (unit ${UNIT})`);

// ── Main loop (100 ms) ─────────────────────────────────────────────────────
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  let dt = (now - last) / 1000; // seconds
  last = now;
  if (dt > 0.5) dt = TICK_MS / 1000; // cap after pause
  step(dt);
}, TICK_MS);

// Helpful logs (you can disable later)
setInterval(() => {
  console.log(
    `level=${level.toFixed(
      1
    )}% inlet=${inletCmd}% outlet=${outletCmd}% status=${status}${
      broken ? " (BROKEN)" : ""
    }`
  );
}, 2000);

// Graceful shutdown
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
