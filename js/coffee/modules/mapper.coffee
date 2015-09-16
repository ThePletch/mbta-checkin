class @Mapper
  @map: null
  @center:
    lat: 42.358
    lng: -71.064
  @selected: null
  @zoom: 14

  @click:
    stopMarker: (marker) ->
      Mapper.markStopSelected(marker)
      Mbta.getNextTrainsToStop marker.id,
        success: (result) ->
          Helpers.events.fire('mapper-mbta-alerts', result.alert_headers.map((a) -> a.header_text))

          predictionData =
            name: result.stop_name
            modes: for mode in result.mode
              routes: for route in mode.route
                routeName: "#{route.route_name} (#{route.direction[0].trip[0].trip_headsign})"
                directions: for dir in route.direction
                  nextTrip = _.min(dir.trip, (trip) -> parseInt(trip.pre_dt))
                  lastTrip = _.max(dir.trip, (trip) -> parseInt(trip.pre_dt))

                  {
                    name: dir.direction_name
                    nextTrip: nextTrip
                    timeBetweenTrains: Helpers.timeBetweenTrains(
                      parseInt(lastTrip.pre_dt) - parseInt(nextTrip.pre_dt),
                      dir.trip.length,
                      Helpers.vehicleName(mode.mode_name))
                    predictStr: Helpers.dateToTime(new Date(parseInt(nextTrip.pre_dt) * 1000))
                    awayStr: Helpers.secondsToTimeString(parseInt(nextTrip.pre_away))
                  }

          Helpers.events.fire('mapper-mbta-predictions', predictionData)

          Mapper.markSelectedStopState('success')
        error: (error) ->
          Mapper.markSelectedStopState('error')

  @initialize: ->
    Mapper.map = new google.maps.Map document.getElementById('viewport'),
      center: Mapper.center
      zoom: Mapper.zoom
      styles: jsonData.google_style
      backgroundColor: '#2a2a2a'
      disableDefaultUI: true

    Helpers.events.bind 'modal-closed', Mapper.removeSelected

    Helpers.events.bind 'ui-location-found', Mapper.zoomToLocation

    Mapper.placeStopMarkers(jsonData.all_stops)
    Mapper.drawLineShapes()

  @drawLineShapes: ->
    $.get "shapes/route_shapes.json", (data) ->
      routes = if typeof data is 'string' then JSON.parse(data) else data
      for route in routes
        for shape in route.shapes
          Mapper.mapShapeFromLatLonList(shape, "##{route.color}")

  @mapShapeFromLatLonList: (latLonList, color) ->
    polyPoints = _.map(latLonList, (point) -> {lat: point.lat, lng: point.lon} )
    path = new google.maps.Polyline
      path: polyPoints
      strokeColor: color
      strokeOpacity: 1.0
      strokeWeight: 5
    path.setMap(Mapper.map)

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

  @placeVehicleMarker: (marker) ->
    new google.maps.Marker
      position: new google.maps.LatLng(marker.lat, marker.lng)
      map: Mapper.map
      title: marker.destination
      icon: marker.icon || Helpers.getLiveIcon(marker)

  @placeStopMarker: (marker) ->
    gMarker = new google.maps.Marker
      position: new google.maps.LatLng(marker.lat, marker.lng)
      map: Mapper.map
      title: marker.name
      icon: marker.icon || Helpers.getIcon(marker)

    google.maps.event.addListener gMarker, 'click', ->
      Mapper.click.stopMarker(marker)

    return gMarker

  @placeStopMarkers: (markers, extractor) ->
    extractor ?= (marker) -> marker # noop function

    Mapper.placeStopMarker(extractor(marker)) for marker in markers

  @removeSelected: ->
    Mapper.selected?.setMap(null)
    Mapper.selected = null

  @zoomToLocation: (location) ->
    Mapper.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude))
    Mapper.map.setZoom(16)
