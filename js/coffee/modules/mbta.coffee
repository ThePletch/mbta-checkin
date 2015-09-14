class @Mbta
  @apiUrl: 'http://realtime.mbta.com/developer/api/v2/'
  @allStops: jsonData.all_stops
  @trainLocations: {}
  # todo replace this with superagent
  @makeApiRequest: (path, additionalParams, callbacks, triggerStatusEvents) ->
    params =
      api_key: 'dHl1-NB5RUSVzujwXXlDZg'

    additionalParams ?= {}
    triggerStatusEvents ?= true

    for key, val of additionalParams
      params[key] = val

    Helpers.events.fire('mbta-api-sent') if triggerStatusEvents

    $.ajax Mbta.apiUrl + path,
      data: params
      success: (data) ->
        Helpers.events.fire('mbta-api-completed', data) if triggerStatusEvents
        callbacks.success(data)
      error: (xhr, status, thrown) ->
        Helpers.events.fire('mbta-api-error', thrown) if triggerStatusEvents

        callbacks.error?(thrown)

  @initialize: ->
  # TODO these should return CS classes to clean up associated code a bunch
  @getAllRoutes: (callback) ->
    Mbta.makeApiRequest('routes', null, callback)
  @getRouteByStop: (stopName, callbacks) ->
    Mbta.makeApiRequest('routesbystop', {stop: stopName}, callbacks)
  @getStopsByRoute: (routeName, callbacks) ->
    Mbta.makeApiRequest('stopsbyroute', {route: routeName}, callbacks)
  @getStopsByLocation: (lat, lon, callbacks) ->
    Mbta.makeApiRequest('stopsbylocation', {lat: lat, lon: lon}, callbacks)
  @getTrainsByRoute: (routeName, callbacks) ->
    Mbta.makeApiRequest('vehiclesbyroute', {route: routeName}, callbacks, false)
  @getNextTrainsToStop: (stop, callbacks) ->
    Mbta.makeApiRequest('predictionsbystop', {stop: stop}, callbacks)
  @updateVehicleLocations: (routes) ->
    trainsFound = []

    Helpers.events.fire('mbta-api-sent')

    atLeastOneSucceeded = false

    async.map routes,
      (routeToCheck, callback) ->
        Mbta.getTrainsByRoute routeToCheck,
          success: (route) ->
            for dir in route.direction
              for trip in dir.trip
                vehicle = trip.vehicle

                trainsFound.push new LiveTrain(
                  vehicle.vehicle_id,
                  route.route_name,
                  trip.trip_headsign,
                  vehicle.vehicle_lat,
                  vehicle.vehicle_lon,
                  vehicle.vehicle_bearing)

            atLeastOneSucceeded = true
            callback()
          error: ->
            console.log("DEBUG: Failed to fetch trains for route #{routeToCheck}.")
            callback()
      ->
        # remove all trains
        train.remove() for train in Mbta.trainLocations
        # add new trains
        train.placeOnMap() for train in trainsFound
        Mbta.trainLocations = trainsFound

        if atLeastOneSucceeded
          Helpers.events.fire('mbta-api-completed')
        else
          Helpers.events.fire('mbta-api-error', 'Could not fetch train locations.')
