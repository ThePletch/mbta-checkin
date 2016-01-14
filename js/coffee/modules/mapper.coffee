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

          $.each result.mode, (i, mode) ->
            mode.vehicle_name = Helpers.vehicleName(mode.mode_name)
            $.each mode.route, (j, route) ->
              route.route_name += " (#{route.direction[0].trip[0].trip_headsign})"

              $.each route.direction, (k, dir) ->
                sum_time_between = 0
                last_trip_scheduled = -1
                $.each dir.trip, (l, trip) ->
                  if last_trip_scheduled != -1
                    sum_time_between += parseInt(trip.pre_dt) - last_trip_scheduled
                  else
                    sum_time_between += parseInt(trip.pre_away)
                  last_trip_scheduled = parseInt(trip.pre_dt)

                dir.time_between_trains = Math.round((sum_time_between/dir.trip.length)/60) + "m"

                dir.predict_str = Helpers.dateToTime(new Date(parseInt(dir.trip[0].pre_dt) * 1000))
                dir.away_str = Helpers.secondsToTimeString(parseInt(dir.trip[0].pre_away))

          Helpers.events.fire('mapper-mbta-predictions', result)

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
    $.get "shapes/route_shapes.json", (routes) ->
      routes = JSON.parse(routes) if typeof routes in [String, 'string']
      for route in routes
        if route.shapes
          for shape in route.shapes
            Mapper.mapShapeFromLatLonList(shape, "##{route.color}")
        else
          console.log(route)

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

    $.each(markers, (i, marker) -> Mapper.placeStopMarker(extractor(marker)))

  @removeSelected: ->
    Mapper.selected.setMap(null)
    Mapper.selected = null

  @zoomToLocation: (location) ->
    Mapper.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude))
    Mapper.map.setZoom(16)
