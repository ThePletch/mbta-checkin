class @Mbta
  @apiUrl: 'https://realtime.mbta.com/developer/api/v2/'
  @userLocMarker: null
  @localStops: []
  @trainLocations: {}

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
  @getStopsByLocation: (lat, lon, callbacks) ->
    Mbta.makeApiRequest('stopsbylocation', {lat: lat, lon: lon}, callbacks)
  @getNearbyStops: (coords, callbacks) ->
    Mbta.getStopsByLocation coords.latitude, coords.longitude,
      success: (result) ->
        callbacks.success(result.stop.filter (stop) ->
          !Stop.isMainStop(stop.stop_id, stop.parent_station)
        .map (stop) ->
          Stop.fromRawApi(stop))
      error: callbacks.error
  @getRoutesByStop: (stop, callbacks) ->
    Mbta.makeApiRequest('routesbystop', {stop: stop.id}, callbacks)
  @getStopsByRoute: (route, callbacks) ->
    Mbta.makeApiRequest('stopsbyroute', {route: route.id}, callbacks)
  @getTrainsByRoute: (route, callbacks) ->
    Mbta.makeApiRequest('vehiclesbyroute', {route: route.id},
      success: (routeInfo) ->
        callbacks.success _.flatten routeInfo.direction.map (dir) ->
          dir.trip.map (trip) ->
            vehicle = trip.vehicle
            return new LiveTrain(
              vehicle.vehicle_id,
              route,
              trip.trip_headsign,
              vehicle.vehicle_lat,
              vehicle.vehicle_lon,
              vehicle.vehicle_bearing)
      error: callbacks.error,
      false) # don't trigger a status indicator update for this call
  @getNextTrainsToStop: (stop, callbacks) ->
    minutesBetweenVehicles = (vehicles) ->
      sumTimeBetween = 0
      lastTripScheduled = -1

      vehicles.forEach (vehicle) ->
        if lastTripScheduled != -1
          sumTimeBetween += parseInt(vehicle.pre_dt) - lastTripScheduled
        else
          sumTimeBetween += parseInt(vehicle.pre_away)
        lastTripScheduled = parseInt(vehicle.pre_dt)

      return Math.round((sumTimeBetween/vehicles.length)/60)

    Mbta.makeApiRequest 'predictionsbystop', {stop: stop.id},
      success: (result) ->
        Helpers.events.fire('mbta-new-alerts', result.alert_headers.map((a) -> a.header_text))
        if result.mode
          parsedResult = result.mode.map (mode) ->
            type: mode.mode_name
            vehicleName: Helpers.vehicleName(mode.mode_name)
            routes: mode.route.map (route) ->
              self: Route.fromRawApi(route)
              endStations: route.direction.map((dir) -> dir.trip[0].trip_headsign).join(" <-> ")
              directions: route.direction.map (dir) ->
                name: dir.direction_name
                trips: dir.trip
                minutesBetweenVehicles: minutesBetweenVehicles(dir.trip)
                predictedNextArrival: new Date(parseInt(dir.trip[0].pre_dt) * 1000)

          Helpers.events.fire('mbta-predictions-found', {stop_name: stop.name, predictions: parsedResult})
          callbacks.success(parsedResult)
        else
          callbacks.error(result)
      error: callbacks.error

  @updateVehicleLocations: (route) ->
    renderRoute = ->
      if route.id in Mapper.defaultRouteIds
        Mapper.featureManager.destroyFeature('traced-route')
      else
        Mapper.featureManager.addFeature('traced-route', route)
    Helpers.events.fire('mbta-api-sent')

    Mbta.getTrainsByRoute route,
      success: (trains) ->
        route.setVehicles(trains)
        renderRoute()
        Helpers.events.fire('mbta-api-completed')
      error: ->
        console.warn("Failed to fetch trains for route #{route.name}.")
        Helpers.events.fire('mbta-api-error', 'Could not fetch train locations.')
