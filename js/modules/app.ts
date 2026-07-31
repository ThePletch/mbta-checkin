import { events } from '../lib/helpers';
const App = {
  getUserLocation() {
    if (navigator.geolocation) {
      events.fire('native-api-sent');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          events.fire('native-api-completed');
          events.fire('app-location-found', pos.coords);
        },
        (error) => {
          events.fire('native-api-error', (() => {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                return 'Denied request to geolocate user';
              case error.POSITION_UNAVAILABLE:
                return 'Could not detect user location';
              case error.TIMEOUT:
                return 'Attempt to find user timed out';
              default:
                return 'Unknown error in geolocation';
            }
          })());
        }
      );
    } else {
      ui.displayAlert('Your browser does not support geolocation', true);
    }
  }
};

window.App = App;
