const App = {
  getUserLocation() {
    if (navigator.geolocation) {
      Helpers.events.fire('native-api-sent');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          Helpers.events.fire('native-api-completed');
          Helpers.events.fire('app-location-found', pos.coords);
        },
        (error) => {
          Helpers.events.fire('native-api-error', (() => {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                return 'Denied request to geolocate user';
              case error.POSITION_UNAVAILABLE:
                return 'Could not detect user location';
              case error.TIMEOUT:
                return 'Attempt to find user timed out';
              case error.UNKNOWN_ERROR:
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
