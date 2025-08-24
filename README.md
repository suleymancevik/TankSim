# 1) Build & run

# git pull https://{githubrepo}/tanksim.git

# docker compose up --build -d

# 2)Point OTee vPLC Modbus client to: HOST_IP:502 (Unit ID = 1)

# (HOST_IP is your machine’s IP on the same LAN; "localhost" from inside

# your vPLC container/VM is NOT your host. Use the real IP or Docker alias. if you host same network, can use localhost)


# 3) Register map (use Holding Registers / Function Code 3/6/16)

# NOTE: Many clients use 0-based addressing in the request PDU.

# Below shows BOTH forms for clarity:

# • 40001 (addr 0) Level% (0..100, int) — read-only

# • 40021 (addr 20) InletValveCmd (0..100, int) — write from vPLC

# • 40022 (addr 21) OutletValveCmd (0..100, int) — write from vPLC

# Optional Input Register (FC4):

# • 30001 (addr 0) Status: 1=OK, 2=>90% high, 3=Broken (>100%)

#

# 4) Physics (every 100 ms):

# inflow = K_IN \* (InletCmd/100)

# outflow = K_OUT_MIN + K_OUT_MAX \* (OutletCmd/100)

# level += (inflow - outflow) \* dt

# Defaults → if both valves = 100%, net +3 %/s ⇒ level rises (as required).

# If level > 90% ⇒ status=2; if level > 100% ⇒ status=3 and sim freezes.

#

# 5) Quick manual test from host (using mbpoll, if installed):

# Read level : mbpoll -m tcp -a 1 127.0.0.1 502 -r 0 -c 1 # 40001

# Write inlet=50 : mbpoll -m tcp -a 1 127.0.0.1 502 -r 20 -t 4 -0 50

# Write outlet=0 : mbpoll -m tcp -a 1 127.0.0.1 502 -r 21 -t 4 -0 0

# Read status IR : mbpoll -m tcp -a 1 127.0.0.1 502 -r 0 -c 1 -t 3 # 30001

#

# 6) Common mapping gotcha:

# If your client treats 40001 as "1" instead of "0", set the starting

# address to 1-based or subtract 1. In this server the request PDU uses

# 0-based addresses: 0→40001, 20→40021, 21→40022.
