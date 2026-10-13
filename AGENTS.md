This is a TypeScript web app that acts as a web frontend for the MBTA API, displayed as interactive markers on a Google Maps overlay.

## Backend

There is no backend to this service other than the MBTA API. Secrets cannot be safely kept in the app, and all code execution will (and must) happen in the end user's browser.

## API interactions

When interacting with the MBTA API, use the `MBTA_API_KEY` variable stored in `.env` to avoid rate limiting.

## Patterns

### Events

The events framework is defined in `lib/events.ts`. Use events for handling side effects of operations, such as updating the request status indicator in the UI's corner. Never use events to transmit data intended for direct display, such as vehicle predictions.
