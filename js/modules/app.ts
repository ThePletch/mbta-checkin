import { fire } from "../lib/events";


export function getUserLocation() {
  if (navigator.geolocation) {
    fire("api-call-sent");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fire("api-call-completed");
        fire("app-location-found", new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
      },
      (error) => {
        fire(
          "api-call-error",
          (() => {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                return "Denied request to geolocate user";
              case error.POSITION_UNAVAILABLE:
                return "Could not detect user location";
              case error.TIMEOUT:
                return "Attempt to find user timed out";
              default:
                return "Unknown error in geolocation";
            }
          })(),
        );
      },
    );
  }
}