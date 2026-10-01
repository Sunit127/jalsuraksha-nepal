# Hackathon demo script (about 5 minutes)

**Core message:** flood warnings alone do not coordinate evacuation and rescue.
JalSuraksha turns warnings, citizen reports and emergency requests into
coordinated evacuation, shelter and rescue workflows.
**Know the Risk. Find Safety. Get Help.**

## Setup (before judges arrive)

| Window | URL | Sign in |
|---|---|---|
| A: Citizen, phone-sized (or a real phone) | `/citizen` | none (guest) |
| B: Operator, laptop | `/dashboard/demo` | Operator Demo |
| C: Rescue, tablet or private window | `/rescue` | Rescue Team Demo |

1. In window B, press **Presentation mode → Reset demo data** so timestamps are fresh.
2. Make sure window A uses the **demo location** (the chip at the top says "Riverside Tole, Bharatpur-1 (demo location)").
3. Say it up front: *"Everything you see is simulated data for the Narayani basin."*

## Script

| # | Screen | Do | Say |
|---|---|---|---|
| 1 | A · Home | Show the red **FLOOD DANGER 84** card; tap *Why is this area danger risk?* | "Every point is explained: the river is above danger level (+30), 140 mm of rain (+18)… It's transparent rule-based decision support, not a black box and not a forecast." |
| 2 | A · Map | Tap **Map** and the legend | "Risk areas, community hazards, shelters and hospitals in one live picture." |
| 3 | A · Route | Home → **FIND SAFE ROUTE** | "The nearest shelter with space is Balkumari, 138 spaces left, about 2 km away over the Riverside Link Bridge." |
| 4 | B | **Flood the Riverside Link Bridge** | *(on A)* "The bridge has just been reported flooded, so the route updates: the red dashed line is blocked and we go via Pulchowk." |
| 5 | A · SOS | Tap **SOS** → *Fill demo scenario* → **SEND SOS NOW** | "No account and no OTP, because someone in danger can't wait for a login. Five people, two children, one elderly person, injured, water rising." |
| 6 | A | Reference `SOS-NEP-####`, **CRITICAL** | "The score is 71 and every factor is shown. It's a recommendation that orders the queue; the operator decides." |
| 7 | B · Operations | The toast and NEW card appear | "It reached the operations centre in under a second." |
| 8 | B | **View Incident** | "Opening it marks it acknowledged, and the citizen sees 'Control centre notified'." |
| 9 | B | **Assign Rescue Team → R-03 → ASSIGN** | "Teams are sorted by availability and distance. R-03 has a boat and first aid and is 2.3 km away." |
| 10 | C | The mission appears | "The rescue team gets it instantly: people, vulnerability, contact and map." |
| 11 | C | **Accept Mission → En Route** | |
| 12 | A | "Rescue Team R-03 dispatched" | "The person waiting knows help is coming. That's the loop a warning SMS can't close." |
| 13 | C | **Arrived → Rescue In Progress → Completed** | |
| 14 | B · Operations | KPIs and charts | "People assisted and team availability update live." |

## If something goes wrong

- **The citizen map has no streets:** tiles need internet access; overlays still render. Carry on.
- **The SOS says "already submitted":** press *Reset demo data* (duplicates are blocked for 10 minutes per phone number).
- **Realtime seems stuck:** the citizen screen also polls every 6 s; refresh the operator window.
- **You can't find R-03:** it's busy from a previous run. Reset the demo data.

## Likely judge questions

- **"Is this machine learning?"** No, deliberately. It's a transparent weighted score with configurable weights. Validated DHM data and expert-tuned weights come next.
- **"What about people without smartphones?"** The SMS fallback (`SOS 5 2 1`) is designed and its parser is tested; it needs a telecom gateway partner.
- **"How do you stop abuse?"** Rate limits, duplicate protection, and operator review of every SOS. Operators can override the priority, and the override is logged.
- **"Offline?"** It's a PWA: the shell, last alerts, shelters, emergency numbers and safety instructions are cached, and an OFFLINE MODE banner shows the last sync time.
