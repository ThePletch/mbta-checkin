class @Mbta
  @apiUrl: 'https://api-v3.mbta.com/'
  @userLocMarker: null
  @localStops: []
  @trainLocations: {}

  @makeApiRequest: (path, additionalParams, callbacks, triggerStatusEvents) ->
    params =
      api_key: '5b1ca80157b74611857c912337044985'

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
    Mbta.makeApiRequest('stops', {filter: {latitude: lat, longitude: lon}}, callbacks)
  @getNearbyStops: (coords, callbacks) ->
    Mbta.getStopsByLocation coords.latitude, coords.longitude,
      success: (result) ->
        callbacks.success(result.data.filter (stop) ->
          !Stop.isMainStop(stop.id, stop.relationships.parent_station)
        .map (stop) ->
          Stop.fromRawApi(stop))
      error: callbacks.error
  @getRoute: (routeId, callbacks) ->
    Mbta.makeApiRequest('routes/' + routeId, {}, callbacks)
  @getRoutesByStop: (stop, callbacks) ->
    Mbta.makeApiRequest('routes', {filter: {stop: stop.id}}, callbacks)
  @getStopsByRoute: (route, callbacks) ->
    Mbta.makeApiRequest('stops', {filter: {route: route.id}}, callbacks)
  @getTrainsByRoute: (route, callbacks) ->
    Mbta.makeApiRequest('vehicles', {filter: {route: route.id}, include: 'trip'},
      success: (routeInfo) ->
        callbacks.success routeInfo.data.map (trainData) ->
          trip = _.findWhere(routeInfo.included, {id: trainData.relationships.trip.data.id})
          train = trainData.attributes
          return new LiveTrain(
            train.label,
            route,
            trip.headsign,
            train.latitude,
            train.longitude,
            train.bearing)
      error: callbacks.error,
      false) # don't trigger a status indicator update for this call
  @getNextTrainsToStop: (stop, callbacks) ->
    # takes a route id and the 'included' segment from the api response and builds the route object
    routeInfoBlock = (id, inclusions) ->
      apiInfo = _.findWhere(inclusions, {id: id})

      {
        name: _.compact([apiInfo.attributes.short_name, apiInfo.attributes.long_name]).join(' - ')
        vehicleName: Helpers.vehicleName(apiInfo.attributes.description)
        directions: {}
      }

    routeDirectionName = (id, directionId, inclusions) ->
      _.findWhere(inclusions, {id: id, type: 'route'}).attributes.direction_names[directionId]

    Mbta.makeApiRequest 'predictions', {filter: {stop: stop.id}, include: 'route'},
      success: (result) ->
        console.log(result)
        resultsByRoute = {}

        result.data.forEach (datum) ->
          prediction = new Date(datum.attributes.arrival_time)
          routeId = datum.relationships.route.data.id
          directionId = datum.attributes.direction_id

          resultsByRoute[routeId] ||= routeInfoBlock(routeId, result.included)
          resultsByRoute[routeId].directions[directionId] ||= {
            name: routeDirectionName(routeId, directionId, result.included)
            predictions: []
          }
          resultsByRoute[routeId].directions[datum.attributes.direction_id].predictions.push(prediction)
        Helpers.events.fire('mbta-predictions-found', {stop_name: stop.name, predictions: resultsByRoute})
        callbacks.success(resultsByRoute)
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
