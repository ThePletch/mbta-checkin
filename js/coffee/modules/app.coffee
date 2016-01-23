class @App
  constructor: () ->
  @getUserLocation: (callback) ->
    if navigator.geolocation
      Helpers.events.fire('mbta-api-sent')
      Mbta.userLocMarker?.setMap(null)
      navigator.geolocation.getCurrentPosition(
        (pos) ->
          Helpers.events.fire('mbta-api-completed')
          callback(pos.coords)
        (error) ->
          Helpers.events.fire('mbta-api-error')
          switch error.code
            when error.PERMISSION_DENIED
              ui.displayAlert('Denied request to geolocate user', true)
            when error.POSITION_UNAVAILABLE
              ui.displayAlert('Could not detect user location', true)
            when error.TIMEOUT
              ui.displayAlert('Attempt to find user timed out', true)
            when error.UNKNOWN_ERROR
              ui.displayAlert('Unknown error in geolocation', true)
        )
    else
      ui.displayAlert('Your browser does not support geolocation', true)
