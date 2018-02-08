Number::leftPad = (len, padder) ->
  s = @toString()
  padder ?= '0'

  while s.length < len
    s = padder + s

  s

class @Helpers
  @events:
    _ev: {}
    bind: (eventName, func) ->
      bindEvent = (name, boundFunc) ->
        self = Helpers.events
        self._ev[name] ?= []
        self._ev[name].push(boundFunc)
      if eventName.constructor is Array
        eventName.map (name) ->
          bindEvent(name, func)
      else
        bindEvent(eventName, func)
    fire: (eventName, params) ->
      self = Helpers.events

      return unless self._ev[eventName]?

      func(params) for func in self._ev[eventName]
  @cache:
    routes: {}
    stops: {}
    vehicles: {}
  @ensureJsonParsed: (json) ->
    if typeof json in [String, 'string']
      return JSON.parse(json)
    else
      return json
  @fetchLocalJson: (url, callback) ->
    $.get url, (data) ->
      callback(Helpers.ensureJsonParsed(data))
  @iconUrls:
    red: 'img/red_line.png'
    green: 'img/green_line.png'
    blue: 'img/blue_line.png'
    orange: 'img/orange_line.png'
    yellow: 'img/yellow_line.png'
    locationReticle: 'img/selected_blue.png'
    selected: 'img/selected.png'
    selectedError: 'img/selected_error.png',
    selectedSuccess: 'img/selected_success.png'
    statusLoading: 'img/spinner.gif'
    statusSuccess: 'img/success.png'
    statusError: 'img/error.png'
  # these colors control the color of live train icons
  # and the color of line overlays
  @lineColors:
    red: '#ff0000'
    green: '#00bb00'
    blue: '#0077cc'
    orange: '#ff8800'
    silver: '#777777'
    bus: '#ffd700'
  @getLineColor: (lineColor) ->
    switch lineColor
      when 'Green-B', 'Green-C', 'Green-D', 'Green-E'
        return Helpers.lineColors.green
      when 'Orange'
        return Helpers.lineColors.orange
      when 'Blue'
        return Helpers.lineColors.blue
      when 'Red', 'Mattapan'
        return Helpers.lineColors.red
      when '741', '742', '751', '749', '746'
        return Helpers.lineColors.silver
      else
        return Helpers.lineColors.bus
  @getLineIcon: (lineColor) ->
    switch lineColor
      when 'Green Line', 'Green Line B', 'Green Line C', 'Green Line D', 'Green Line E'
        return Helpers.iconUrls.green
      when 'Orange Line'
        return Helpers.iconUrls.orange
      when 'Blue Line'
        return Helpers.iconUrls.blue
      when 'Red Line', 'Mattapan Trolley'
        return Helpers.iconUrls.red
      when 'Location'
        return Helpers.iconUrls.locationReticle
      else
        return Helpers.iconUrls.yellow
  @getLiveIcon: (train) ->
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
      fillColor: train.line.color
      fillOpacity: 1
      rotation: train.bearing
      scale: 4
      strokeWeight: 1
    }
  @getIcon: (line) ->
    return {
      scaledSize: new google.maps.Size(24, 24)
      anchor: new google.maps.Point(12, 12)
      url: Helpers.getLineIcon(line)
    }
  @dateToTime: (date) ->
    hours = (date.getHours() - 1) % 12 + 1
    minutes = date.getMinutes().leftPad(2)
    amPm = if (date.getHours() >= 12) then 'pm' else 'am'

    "#{hours}:#{minutes} #{amPm}"
  @secondsToTimeString: (time) ->
    minutes = Math.floor(time/60)

    if minutes > 0 then minutes + ' mins' else 'Arr'
  @vehicleName: (modeName) ->
    vehicleNameMap =
      'Subway': 'trains'
      'Bus': 'buses'
      'Commuter Rail': 'trains'

    vehicleNameMap[modeName]
  @mergePredictions: (predictions) ->
    mergePair = (pair, subarrayExtractor, keyExtractor, mergeFunction) ->
      newSet = {}
      for element in subarrayExtractor(pair[1])
        currentValue = newSet[keyExtractor(element)]
        unless currentValue
          newSet[keyExtractor(element)] = element
        else
          newSet[keyExtractor(element)] = mergeFunction(currentValue, element)
      val for key, val of newSet
    mergePredictionPair = (prediction, secondPrediction) ->
      subarrExtractor = (prediction) -> prediction.routes
      keyExtractor = (route) -> route.self.name
      _.extend prediction,
        routes: mergePair([prediction, secondPrediction],
          subarrExtractor,
          keyExtractor,
          mergeRoutePair)
    mergeRoutePair = (route, secondRoute) ->
      subarrExtractor = (route) -> route.directions
      keyExtractor = (direction) -> direction.name
      _.extend route,
        directions: mergePair [route, secondRoute],
          subarrExtractor,
          keyExtractor,
          mergeDirectionPair
    mergeDirectionPair = (dir, secondDir) ->
      minutesAway: Math.min(dir.minutesAway, secondDir.minutesAway)
      minutesBetweenVehicles: dir.minutesBetweenVehicles
      name: dir.name
      predictedNextArrival: _.min([dir.predictedNextArrival, secondDir.predictedNextArrival])
      trips: dir.trips.concat(secondDir.trips).sort((a, b) -> parseInt(b.pre_away) - parseInt(a.pre_away))
    newPredictions = {}
    for prediction in predictions
      unless newPredictions[prediction.type]
        newPredictions[prediction.type] = prediction
      else
        newPredictions[prediction.type] = mergePredictionPair(newPredictions[prediction.type], prediction)
    val for key, val of newPredictions

class @Template
  @formats:
    locales: "en-US"
    formats:
      time:
        hhmm:
          hour: "numeric"
          minute: "numeric"
      relative:
        minutes:
          units: "minute"
  constructor: (name, compiledCallback) ->
    @compiled = false
    @_template = null

    setCompiledData = (data) =>
      @_template = data
      @compiled = true

    $.get "hb/#{name}.hdbs", (data) ->
      setCompiledData(Handlebars.compile(data))
      compiledCallback()


  render: (context) ->
    return @compiled && @_template context,
      data:
        intl: Template.formats

class @Marker
  constructor: (@lat, @lng, @category) ->
  render: =>
    @marker = Mapper.placeMarker(this)
  destroy: =>
    if @marker
      @marker.setMap(null)
    else
      console.warn(this)

class @LocationMarker extends Marker
  constructor: (@lat, @lng) ->
    @category = 'Location'
  render: =>
    @marker = Mapper.placeMarker(@lat, @lng, @category, Helpers.getIcon(@category))

class @Stop extends Marker
  constructor: (@id, @name, @lat, @lng, @category) ->
    super @lat, @lng, @category

    Helpers.cache.stops[@id] = this
  render: =>
    @marker = Mapper.placeMarker(@lat, @lng, @name, Helpers.getIcon(@category))
    console.log(@marker) unless @marker

    @listener = google.maps.event.addListener @marker, 'click', @onClick
  @fromRawApi: (api) ->
    return Helpers.cache.stops[api.stop_id] or new Stop(api.stop_id, api.stop_name, parseFloat(api.stop_lat), parseFloat(api.stop_lon), "Bus")
  @isMainStop: (id, parentStation) ->
    Mapper.defaultStopIds.indexOf(id) isnt -1 or parentStation isnt ""
  onClick: =>
    Helpers.events.fire('stop-selected', this)
    stopAndChildren = [this.id].concat(jsonData.stop_descendants[this.id] || [])
    async.map stopAndChildren, ((stopId, callback) ->
      Mbta.getNextTrainsToStop {id: stopId},
        success: (result) ->
          callback(null, result)
        error: (err) ->
          callback(err)),
      (err, predictions) =>
        if err
          Helpers.events.fire('stop-fetchdata-error', this)
        else
          result = Helpers.mergePredictions(_.flatten(predictions))
          unless result.length > 0
            Helpers.events.fire('stop-fetchdata-error', this)
            console.warn("No predictions found for stop #{result.stop_name} (ID #{result.stop_id})")
            return
          Helpers.events.fire('mbta-predictions', {stop_name: @name, predictions: result})
          Helpers.events.fire('stop-fetchdata-success', this)

class @Vehicle extends Marker
  render: =>
    @marker = Mapper.placeVehicleMarker(this)

class @LiveTrain extends Vehicle
  constructor: (@id, @line, @destination, lat, lng, bearing) ->
    super parseFloat(lat), parseFloat(lng), @line
    @bearing = parseInt(bearing)

    Helpers.cache.vehicles[@id] = this

class @Alert
  constructor: (@text) ->
    @timestamp = new Date()
  matches: (text) ->
    @text is text
  equals: (thing) ->
    this is thing or @matches(thing)

class @Route
  constructor: (@id, @name, @mode, @stops, @vehicles) ->
    @color = Helpers.getLineColor(@id)
    @stops ?= []
    @vehicles ?= []

    Helpers.cache.routes[@id] = this
  setVehicles: (vehicles) ->
    Mapper.featureManager.addFeature("live-vehicles", vehicles)
    @vehicles = vehicles
  @fromRawApi: (api) ->
    Helpers.cache.routes[api.route_id] ?= new Route(api.route_id, api.route_name, "Subway")
  @getShapes: (id, callback) ->
    async.map jsonData.shapes_by_route[id],
      (shapeId, subCallback) ->
        Helpers.fetchLocalJson "shapes/routes/#{shapeId}.json", (shapes) ->
          subCallback(null, shapes)
      (error, shapeSet) ->
        callback _.map shapeSet, (latLons) ->
          _.map latLons, (point) ->
            {lat: point.lat, lng: point.lon}
  render: (renderStops) ->
    Route.getShapes @id, (shapes) =>
      @paths ?= shapes.map (shape) =>
        new google.maps.Polyline
          path: shape
          strokeColor: @color
          strokeOpacity: @opacity()
          strokeWeight: 5
      @paths.map((path) -> path.setMap(Mapper.map))

    @stops.map((stop) -> stop.render()) if renderStops
  destroy: ->
    @paths?.map((path) -> path.setMap(null))
    @paths = null
    @stops.map((stop) -> stop.destroy())
    #@vehicles.map((vehicle) -> vehicle.destroy())
  opacity: ->
    1.0

window.templates = {}
window.jsonData = {}

# load templates and JSON before initializing map
$ ->
  registerHandlebarsHelpers = ->
    Handlebars.registerHelper 'time', (date) ->
      date.toLocaleString 'en-US',
        timeZone: "America/New_York"
        hour: "numeric"
        minute: "numeric"
    Handlebars.registerHelper 'arriving', (date) ->
      minutesAway = new Date(date - new Date()).getMinutes()
      if minutesAway is 0
        "Arriving"
      else
        "#{minutesAway} minutes"

  compileTemplates = (compiledCallback) ->
    registerHandlebarsHelpers()
    async.map ['prediction-info', 'alerts'],
      (templateName, callback) ->
        window.templates[templateName] = new Template(templateName, callback)
      (error, success) ->
        if error
          compiledCallback("FATAL: Could not load templates. #{error}")
        else
          Helpers.events.fire('templates-rendered')
          compiledCallback()
  loadJson = (loadedCallback) ->
    async.map ['default_stops', 'google_style', 'routes', 'routes_by_line', 'shapes_by_route', 'stops', 'stop_descendants'],
      (jsonName, callback) ->
        Helpers.fetchLocalJson "js/json/#{jsonName}.json", (data) ->
          window.jsonData[jsonName] = data
          callback()
      (error, success) ->
        if error
          console.error(error)
          loadedCallback("FATAL: Could not load JSON. #{error}")
        else
          Helpers.events.fire('json-loaded')
          loadedCallback()
  async.map [loadJson, compileTemplates],
    (prepFunction, callback) ->
      prepFunction(callback)
    (error, success) ->
      if error
        console.error(error)
      else
        Helpers.events.fire('prep-complete')
