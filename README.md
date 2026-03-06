# TAMU-OSSF Center SCADA

Web-based SCADA dashboard for the Texas A&M On-Site Sewage Facility.

This application lets operators and admins:
- Monitor PLC-connected devices and live property values.
- Evaluate and track property alert conditions.
- Send alert emails through a configured Gmail sender account.
- Configure per-property CSV recording/export.
- Configure per-property alert thresholds and value-display rules.
- Manage the visual Center Map layout and PLC location assignments.

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- PostgreSQL (Neon) + Drizzle ORM
- Arduino IoT Cloud API (`@arduino/arduino-iot-client`)
- Nodemailer (Gmail SMTP)
- shadcn/ui + Radix UI

## Project Structure
- `app/` - pages, server actions, and API routes.
- `components/function/` - feature components used by pages.
- `db/` - Drizzle schema and DB client.
- `lib/` - integrations, background processing, alert and recording logic.
- `forms/` - Zod form schemas.

## Requirements
- Node.js 20+
- npm
- PostgreSQL database
- Arduino IoT API client credentials

## Environment Variables
Set these in `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string used by app and Drizzle push |
| `SESSION_SECRET` | Yes | Secret for session JWT signing/verification |
| `ARDUINO_API_CLIENT_ID` | Yes | Arduino IoT API OAuth client ID |
| `ARDUINO_API_CLIENT_SECRET` | Yes | Arduino IoT API OAuth client secret |
| `CRON_SECRET` | Recommended | Bearer token for `/api/alerts/run` and `/api/recordings/run` |
| `ALERT_EMAIL_ENCRYPTION_KEY` | Recommended | Encryption key for stored Gmail App Password |
| `ENCRYPTION_KEY` | Optional fallback | Fallback key if `ALERT_EMAIL_ENCRYPTION_KEY` is not set |

## Setup and Run
1. Create your local environment file:
```bash
cp .env.example .env
```
2. Fill in `.env` with real values.
3. Install dependencies:
```bash
npm install
```
4. Apply schema to the database:
```bash
npm run push
```
5. Start development server:
```bash
npm run dev
```
6. Open:
- `http://localhost:3000/login`

## Build and Lint
```bash
npm run lint
npm run build
npm run start
```

## Background Jobs (Cron)
Two API routes are designed for scheduled execution.

- `GET /api/alerts/run`
- `GET /api/recordings/run`

If `CRON_SECRET` is set, include:
- Header: `Authorization: Bearer <CRON_SECRET>`

These jobs are responsible for:
- Running alert processing and dispatching alert emails for new alert episodes.
- Collecting due CSV recording rows based on each property's configured interval.

## CSV Endpoints
- Alert history CSV: `GET /api/alerts/csv`
- Property recording CSV: `GET /api/recordings/{thingId}/{propertyId}/csv`

## Alerting Behavior Summary
- Alerts are evaluated for `INT` and `FLOAT` properties.
- A property enters alert when its value is outside configured min/max thresholds.
- Email notifications are sent once per alert episode and reset after returning in-range.
- Alert history is stored and capped to a rolling maximum (10,000 events).

## Property Recording Behavior Summary
- Recording can be enabled per property.
- Interval must be a whole number >= 5 and a multiple of 5 minutes.
- Max rows must be between 1 and 10,000.
- Changing interval/max rows (or disabling recording) clears historical rows after confirmation.

---

# Admin User Manual

This section is intended as a thorough, page-by-page guide for system administrators.

## Navigation and Access
The authenticated app shell (`/app/*`) includes:
- Sidebar links:
  - `Dashboard`
  - `Center Map`
  - `Settings`
  - `User Management` (shown for admins)
- Logout button in the sidebar footer.

Primary pages:
- `/` (redirects to `/login` when not signed in)
- `/login`
- `/app` (Dashboard)
- `/app/device/[id]`
- `/app/center-map`
- `/app/settings`
- `/app/user_management`

---

## 1) Login Page (`/login`)

### What this page contains
- App title header.
- Email field.
- Password field.
- `Log In` button.

### How to use it
1. Enter a valid user email.
2. Enter password.
3. Click `Log In`.

### Validation and error behavior
- Email must be valid format.
- Password must be at least 6 characters.
- Invalid credentials return a generic error toast (`Invalid email or password`).

---

## 2) Dashboard (`/app`)

### Header area
- Title: `Dashboard`
- Subtitle welcome text.

### Summary cards
- `Active PLC Devices`
  - Shows online PLC count and total detected devices.
- `System Status`
  - `Operational`, `Degraded`, or `Critical` based on the ratio of offline PLCs to online PLCs.
- `Active Alerts`
  - Current number of properties causing an alert.

### Alert History CSV section
- Card: `Alert History CSV`
- `Preview CSV` button:
  - Opens modal table with recent alert-event rows. Time displayed in `Date/Time` uses the timezone of the user.
- `Download CSV` button:
  - Downloads full alert history CSV. Time displayed in `datetime` uses the GMT timezone.

### Active Systems table
Columns:
- PLC ID
- Name
- Status
- Details

Actions:
- `Details` opens the selected device page.

Visual cues:
- Red alert icon beside PLC ID when device has one or more active property alerts.
- Status badge indicates online/warning state.

---

## 3) Device Detail Page (`/app/device/[id]`)

### Header
- `Back to Dashboard` button.
- Device name.

### PLC Information card
Shows:
- PLC ID
- Name
- Model
- Last Active timestamp

### Maintenance Information card
Shows:
- Current online/offline status
- Serial number

### Arduino Properties section
Each property appears as its own card with:
- Property name and type metadata
- Permission badge (`READ_ONLY` or `READ_WRITE`)
- Current value
- Last update timestamp
- Alert icon if property is out-of-range

For `READ_WRITE` properties:
- `STATUS` uses a toggle switch.
- Other writable types use input box updates.
- Updates are sent immediately and show `Updating...` while pending.

Property Details subsection:
- Variable name
- Tag
- Persist setting

CSV Recording subsection:
- Shows whether recording is enabled for this property.
- If enabled:
  - interval + max rows shown
  - `Preview CSV` opens modal row preview. Time displayed in `Date/Time` uses the timezone of the user.
  - `Download CSV` downloads property CSV. Time displayed in `datetime` uses the GMT timezone.
- If disabled:
  - helper message points admin to Settings

---

## 4) Center Map (`/app/center-map`)

### Purpose
- Map-like view of location boxes and their PLC assignments.
- Supports normal operation mode and admin layout edit mode.

### Normal mode (all authenticated users)
Main canvas behavior:
- Each box displays:
  - location name
  - status icon (unassigned/unknown/alert/healthy)
  - assigned PLC label (or unassigned text)
- Clicking a box opens location detail dialog.

Location detail dialog sections:
- Basic PLC details
  - Assigned PLC name
  - PLC ID
  - Status
  - Last active
  - Alerts indicator
- Assign PLC
  - Dropdown of available PLCs
  - `Connect` button to assign
  - `Remove PLC` button to unassign
- Properties table
  - Property name/value list
  - Alert indicator per property when applicable
- `View Details` button
  - Opens linked device page

Mobile behavior:
- Shows location cards in a responsive grid instead of absolute-position map canvas.

### Layout edit mode (admins)
Entry:
- `Edit Layout` button (admins only).

Edit mode controls:
- `Add Box`
- `Save Layout`
- `Cancel`

Edit mode behavior:
- Drag boxes freely on desktop/tablet.
- Text selection is disabled during drag for smoother movement.
- Box content is simplified for layout editing:
  - Location name display
  - Rename button
  - Delete button
  - Drag hint text
- PLC assignment and status details are not shown in edit cards.

Rename flow:
1. Click rename icon on a box.
2. Rename modal opens.
3. Enter full location name.
4. Click `Save Name`.

Save/Cancel behavior:
- `Save Layout` persists all add/move/rename/delete changes globally.
- `Cancel` discards unsaved layout changes.

Validation rules on save:
- Name required.
- Names must be unique (case-insensitive).
- Coordinates are clamped to map bounds.

Admin-only note:
- Layout editing is restricted to admins.
- If edit mode is active and viewport switches to mobile, edit mode is disabled.

---

## 5) Settings (`/app/settings`)

Page purpose:
- Central admin control panel for email alerts, thresholds, display formatting, and CSV recording config.

### 5.1 Gmail Account section
Fields:
- Sender email (Gmail)
- Gmail App Password

Action:
- `Save sender settings`

Behavior:
- Password is encrypted before DB storage.
- Leaving password blank while updating keeps existing stored password.

### 5.2 Email Recipients section
Fields/actions:
- Add recipient email input
- `Add recipient`
- Recipient list with remove buttons

Validation:
- Email format required.
- Duplicate recipient emails prevented.

### 5.3 Alert Thresholds section
Workflow:
1. Choose PLC from dropdown.
2. For each numeric property (`INT` / `FLOAT`), set `Min` and/or `Max`.
3. Click `Save` on property row.

Behavior:
- If both min and max are blank, threshold is cleared.
- Non-numeric properties are shown as non-thresholdable.
- Out-of-range values drive alert state and email notifications.

### 5.4 Property Value Display section
Global setting:
- Set decimal places for all values.
- Blank means no forced decimal formatting.

Per-property override:
- Choose PLC.
- Set property-level decimal places and save.

Rules:
- Decimal places must be integer between 0 and 10.
- FLOAT properties support decimal-place formatting.
- Clearing override reverts to global setting.

### 5.5 Property CSV Recording section
Workflow:
1. Choose PLC.
2. For each property, toggle `Record CSV data`.
3. Set `Interval (min)` and `Max rows` when enabled.
4. Click `Save`.

Rules and constraints:
- Interval: integer, >= 5, multiple of 5.
- Max rows: integer, 1 to 10,000.
- Disabling recording or changing interval/max rows triggers data-clear confirmation and removes old rows after confirmation.

---

## 6) User Management (`/app/user_management`)

Intended audience:
- Admins managing access.

### System Users section
Table columns:
- Name
- Email
- Role
- Actions

Actions:
- Edit user (opens modal)
  - Update name/email/role
  - Save changes
- Delete user
  - Removes user record

### Add New User section
Fields:
- Full Name
- Email Address
- Password

Action:
- `Add User`

Validation:
- Name required.
- Email valid format.
- Password minimum 6 characters.

---

## Operational Notes for Admins
- Configure alert email sender + recipients before expecting email delivery.
- Ensure cron scheduler calls both run endpoints for continuous background processing.
- Keep `CRON_SECRET` configured in production and send it as Bearer token.
- After schema changes, run `npm run push` before deployment.

## Quick Troubleshooting
- Alert emails not sending:
  - Verify Gmail sender, app password, recipients.
  - Verify encryption key stability (`ALERT_EMAIL_ENCRYPTION_KEY`).
- CSV data not accumulating:
  - Verify recording enabled per property.
  - Verify `/api/recordings/run` cron schedule and auth header.
- Alert history not updating:
  - Verify thresholds and live values.
  - Verify `/api/alerts/run` cron schedule and auth header.
- Center map save issues:
  - Ensure location names are non-empty and unique.
  - Ensure you are logged in as admin for layout editing.
