This is a TypeScript web app that acts as a web frontend for the MBTA API, displayed as interactive markers on a Google Maps overlay.

## Backend

There is no backend to this service other than the MBTA API. Secrets cannot be safely kept in the app, and all code execution will (and must) happen in the end user's browser.

## API interactions

When interacting with the MBTA API, use the `MBTA_API_KEY` variable stored in `.env` to avoid rate limiting.

## Static files

Files in `js/json` are static, and were generated programmatically by scripts. These scripts have been lost, and these files may be out of date. If you find records in those files that conflict with the MBTA API, the API's results are authoritative. Do not update the files unless the user requests it.