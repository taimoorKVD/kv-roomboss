# RoomBoss Portal

A simple Node.js + Tailwind web app for non-technical users to use the RoomBoss APIs from the Postman collection — list hotels, check availability, create bookings, and more — without opening Postman.

## Quick start

```bash
cd app
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Accounts (from Postman)

| Sidebar label   | Username         | API host                          | Postman folder           |
|-----------------|------------------|-----------------------------------|--------------------------|
| AGENT ONE API   | `AGENT_ONE_API`  | `api.roomboss.com`                | Booking                  |
| JSE (ACC-JSE)   | `JSE`            | `api.roomboss.com`                | Booking With ACC-JSE     |
| Staging Demo    | `agentDemo`      | `api.staging.roomboss.com`        | Other (staging)          |

Credentials live in `.env` (see `.env.example`). Do not commit real passwords to shared remotes.

## Modules

| Module            | RoomBoss endpoint                         |
|-------------------|-------------------------------------------|
| List Hotels       | `GET /extws/hotel/v1/list`                |
| Available Stays   | `GET /extws/hotel/v1/listAvailable`       |
| Rate Plans        | `GET /extws/hotel/v1/listRatePlanDescription` |
| Create Booking    | `GET /extws/hotel/v1/createBooking`       |
| View Booking      | `GET /extws/hotel/v1/listBooking`         |
| All Bookings      | `GET /extws/hotel/v1/listBookings`        |
| Cancel Booking    | `GET /extws/hotel/v1/cancelBooking`       |

Date fields use a normal calendar picker; the server converts them to RoomBoss `YYYYMMDD` format.

## Typical flow for a domain user

1. Select **API account** in the sidebar.
2. Open **List Hotels** → enter country/location → **Run query**.
3. Use the **search** box and **pagination** controls on the results table.
4. Click **View detail** on any row for a full record page (fields + nested tables).
5. Copy IDs into **Available Stays** / **Create Booking** as needed.

## Listing UX

- **Search** — filters the current result set across all fields (client request to session-backed API).
- **Pagination** — 10 / 25 / 50 rows per page with previous/next and page numbers.
- **Detail pages** — `/modules/:moduleId/records/:recordId` with summary fields, nested arrays, and raw JSON.
