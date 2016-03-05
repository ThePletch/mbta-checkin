class @Mapper
  @map: null
  @defaultStops: []
  @defaultRouteIds: ["741", "742", "746", "749", "751", "Green-B", "Green-C", "Green-D", "Green-E", "Red", "Blue", "Orange"]
  @defaultStopIds: []
  @center:
    lat: 42.358
    lng: -71.064
  @selected: null
  @zoom: 14
  @featureManager:
    _features: {}
    addFeature: (key, feature) ->
      Mapper.featureManager.destroyFeature(key)
      Mapper.featureManager._features[key] = feature
      Mapper.featureManager.renderFeature(key)
    # boilerplate getter to avoid needing to expose _features
    getFeature: (key) ->
      return Mapper.featureManager._features[key]
    destroyFeature: (key) ->
      return unless Mapper.featureManager._features[key]

      feature = Mapper.featureManager._features[key]

      if feature.constructor is Array
        console.log("Destroying #{feature.length} objects")
        for subfeature in feature
          subfeature.destroy()
      else
        feature.destroy()
    renderFeature: (key) ->
      return unless Mapper.featureManager._features[key]

      feature = Mapper.featureManager._features[key]

      if feature.constructor is Array
        console.log("Rendering #{feature.length} objects")
        feature.forEach((subfeature) -> subfeature.render())
      else
        feature.render()

  @initialize: ->
    Mapper.map = new google.maps.Map document.getElementById('viewport'),
      center: Mapper.center
      zoom: Mapper.zoom
      styles: jsonData.google_style
      backgroundColor: '#2a2a2a'
      disableDefaultUI: true

    Mapper.featureManager.addFeature 'defaultRoutes', Mapper.defaultRouteIds.map (routeId) ->
      route = jsonData.routes[routeId]
      new Route(route.id, route.name, route.mode)

    Mapper.defaultStopIds = jsonData.default_stops
    Mapper.featureManager.addFeature 'defaultStops', Mapper.defaultStopIds.map (stopId) ->
      stop = jsonData.stops[stopId]
      new Stop(stop.id, stop.name, stop.lat, stop.lon, "Bus")

    Helpers.events.bind 'modal-closed', Mapper.removeSelected

    Helpers.events.bind 'ui-location-found', (coords) ->
      Mapper.featureManager.addFeature('userLocation', new LocationMarker(coords))
      Mapper.zoomToLocation(coords)
      Mbta.getNearbyStops coords,
        success: (stops) ->
          Mapper.featureManager.addFeature('localStops', stops)
        error: console.error

    Helpers.events.bind 'stop-selected', Mapper.markStopSelected

    Helpers.events.bind 'stop-fetchdata-success', ->
      Mapper.markSelectedStopState('success')

    Helpers.events.bind 'stop-fetchdata-error', ->
      Mapper.markSelectedStopState('error')

  @markSelectedStopState: (state) ->
    currentIcon = Mapper.selected.getIcon()
    currentIcon.url = switch state
      when 'error' then Helpers.iconUrls.selectedError
      when 'success' then Helpers.iconUrls.selectedSuccess
    Mapper.selected.setIcon(currentIcon)

  # TODO improve naming in marker manipulation methods
  @markStopSelected: (marker) ->
    # delete any existing selection marker
    Mapper.removeSelected() if Mapper.selected?

    Mapper.selected = new google.maps.Marker
      position: new google.maps.LatLng(marker.lat, marker.lng)
      map: Mapper.map
      icon:
        url: Helpers.iconUrls.selected
        scaledSize: new google.maps.Size(33, 33)
        anchor: new google.maps.Point(16, 16)
  @placeMarker: (lat, lon, title, icon) ->
    return new google.maps.Marker
      position: new google.maps.LatLng(lat, lon)
      map: Mapper.map
      title: title
      icon: icon
  @placeLocationMarker: (coords) ->
    Mapper.placeMarker(coords.latitude, coords.longitude, "Location",
      Helpers.getIcon(line: "Location"))
  @placeVehicleMarker: (marker) ->
    Mapper.placeMarker(marker.lat, marker.lng, marker.destination,
      marker.icon || Helpers.getLiveIcon(marker))

  # TODO deprecate
  @placeStopMarker: (marker) ->
    gMarker = Mapper.placeMarker(marker.lat, marker.lng, marker.name,
      marker.icon || Helpers.getIcon(marker))

    google.maps.event.addListener gMarker, 'click', ->
      Mapper.click.stopMarker(marker)

    return gMarker

  # TODO deprecate
  @placeStopMarkers: (markers, extractor) ->
    extractor ?= (marker) -> marker # noop function

    $.each(markers, (i, marker) -> Mapper.placeStopMarker(extractor(marker)))

  @removeSelected: ->
    Mapper.selected.setMap(null)
    Mapper.selected = null

  @zoomToLocation: (location) ->
    Mapper.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude))
    Mapper.map.setZoom(16)
