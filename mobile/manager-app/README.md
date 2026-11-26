# Rupadiya Bus Manager app (Expo / React Native)

For bus managers who travel with the bus. Five tabs, with **Scan** as the big button in the centre of the bottom bar:

- **Home**: pick a date on the strip (dots show days with trips) and see your bus for that day: departure/arrival, bus number, boarded progress, passengers yet to board, payment-pending and agent tickets.
- **Passengers**: everyone on the bus, grouped by boarding stop in route order.
  - Filters: yet to board, on board, dropped, no-show, payment pending, agent tickets. Search by name, PNR, seat or phone.
  - Each passenger shows pills for **Agent / Online booking** and **Payment complete / Payment pending**, plus a call button.
- **Scan**: scan the ticket QR (torch available) or type the PNR. The full ticket opens, showing:
  - passengers and seats, lap infants, and boarding and dropping stops with times
  - call buttons for the passenger, emergency contact and agent
  - booking source, payment and fare
- **Bus**: bus number and type, driver and co-driver with call buttons, company office, the boarding and dropping stops with passenger counts, and **Start / Complete journey**.
- **Profile**: account, offline actions with "Sync now", server, and log out.

**Actions:** board, move to next stop (late passenger), change drop stop, no-show, drop, start and complete.
- Each action opens a confirmation step. The button shows a spinner and is locked while it runs.
- Every action carries an id, and the server claims that id before doing the work. A double tap, a retry or an offline replay is applied only once.
- When a passenger boards at a different stop or gets off at a different stop, the manager picks a reason. The passenger, the company and RBS then get a WhatsApp message. The booked stop stays on the ticket.
- Agent cash tickets that the company office has not received show **"DO NOT BOARD — payment pending"** and cannot be boarded.
- When the journey starts, only passengers booked at the first stop become no-shows. Passengers expected at later stops stay "yet to board".
- **Offline:** the passenger list is cached, actions are queued and sync automatically.

The app is kept outside `apps/` on purpose. The root npm workspace includes every folder under `apps/`, and React Native's dependencies must not be mixed with the Next.js apps.

## Setup

The app uses **Expo SDK 58** (React Native 0.88, React 19). Install the matching **Expo Go** from the Play Store / App Store. Expo Go only opens projects built for the same SDK.

```bash
cd mobile/manager-app
npm install
npx expo install --check   # should print "Dependencies are up to date"
```

**API address.** In development (`npx expo start`), the app connects to the computer running Expo on port 4500, so a phone on the same Wi-Fi works without any setup. To use a different server, tap **Change server** on the login screen and enter an IP (port 4500 is added) or an https address. The phone remembers it.

For builds (APK), set the address in `app.json` → `expo.extra.apiUrl`:

| Where the app runs | apiUrl |
|---|---|
| Android emulator, local API | `http://10.0.2.2:4500/api/v1` |
| Physical phone on the same Wi-Fi | `http://<your-PC-LAN-IP>:4500/api/v1` |
| Production | `https://<your-api-domain>/api/v1` |

```bash
npx expo start          # scan the QR with Expo Go, or press "a" for the Android emulator
```

## Build an installable APK

```bash
npm install -g eas-cli
eas login
npm run build:apk       # EAS "preview" profile → downloadable .apk
```

## Accounts

Bus managers are created by the company owner (Company portal → **Bus Managers**). The owner then assigns them to trips, either per trip in the Trip Scheduler or as a default manager per bus. Only `BUS_MANAGER` accounts can log in to this app.
