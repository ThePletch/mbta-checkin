class @App
  constructor: () ->
  @getUserLocation: ->
    if navigator.geolocation
      Helpers.events.fire('native-api-sent')
      navigator.geolocation.getCurrentPosition(
        (pos) ->
          Helpers.events.fire('native-api-completed')
          Helpers.events.fire('app-location-found', pos.coords)
        (error) ->
          Helpers.events.fire 'native-api-error',
            switch error.code
              when error.PERMISSION_DENIED
                'Denied request to geolocate user'
              when error.POSITION_UNAVAILABLE
                'Could not detect user location'
              when error.TIMEOUT
                'Attempt to find user timed out'
              when error.UNKNOWN_ERROR
                'Unknown error in geolocation'
      )
    else
      ui.displayAlert('Your browser does not support geolocation', true)
