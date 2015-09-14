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
      self = Helpers.events
      self._ev[eventName] ?= []
      self._ev[eventName].push(func)
    fire: (eventName, params) ->
      self = Helpers.events

      return unless self._ev[eventName]?

      func(params) for func in self._ev[eventName]
  @iconUrls:
    red: 'img/red_line.png'
    green: 'img/green_line.png'
    blue: 'img/blue_line.png'
    orange: 'img/orange_line.png'
    redGreen: 'img/red_green_line.png'
    redOrange: 'img/red_orange_line.png'
    orangeBlue: ''
    blueGreen: 'img/green_blue_line.png'
    orangeGreen: 'img/orange_green_line.png'
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
    green: '#00ff00'
    blue: '#0077cc'
    orange: '#ff8800'
  @getLineColor: (lineColor) ->
    switch lineColor
      when 'Green Line', 'Green Line B', 'Green Line C', 'Green Line D', 'Green Line E'
        return Helpers.lineColors.green
      when 'Orange Line'
        return Helpers.lineColors.orange
      when 'Blue Line'
        return Helpers.lineColors.blue
      when 'Red Line', 'Mattapan Trolley'
        return Helpers.lineColors.red
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
  @getLiveIcon: (train) ->
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
      fillColor: Helpers.getLineColor(train.line)
      fillOpacity: 1
      rotation: train.bearing
      scale: 4
      strokeWeight: 1
    }
  @getIcon: (icon) ->
    return {
      scaledSize: new google.maps.Size(24, 24)
      anchor: new google.maps.Point(12, 12)
      url: Helpers.getLineIcon(icon.line)
    }
  @dateToTime: (date) ->
    hours = (date.getHours() - 1) % 12 + 1
    minutes = date.getMinutes().leftPad(2)
    amPm = if (date.getHours() >= 12) then 'pm' else 'am'

    "#{hours}:#{minutes} #{amPm}"
  @secondsToTimeString: (time) ->
    minutes = Math.floor(time/60)

    if minutes > 0 then minutes + ' mins' else 'Arr'
  @timeBetweenTrains: (deltaSec, trainCount, vehicleName) ->
    if trainCount is 1
      "No #{vehicleName} after this"
    else
      minutes = Math.floor((deltaSec/60)/trainCount)
      "#{minutes}m between #{vehicleName}"
  @vehicleName: (modeName) ->
    vehicleNameMap =
      'Subway': 'trains'
      'Bus': 'buses'
      'Commuter Rail': 'trains'

    vehicleNameMap[modeName]

class @Template
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
    return @compiled && @_template(context)

class @Stop
  constructor: (@lat, @lng, @name, directions) ->
    @directions = directions || {}

  getIcon: ->
    Helpers.getIcon(this)

class @Direction
  constructor: (@name, substops) ->
    @substops = substops || []

class @Substop
  constructor: (@id, @name, @line) ->

class @Train
  constructor: (@name, @eta, @etaString) ->

class @LiveTrain
  constructor: (@id, @line, @destination, lat, lng, bearing) ->
    @lat = parseFloat(lat)
    @lng = parseFloat(lng)
    @bearing = parseInt(bearing)
  placeOnMap: ->
    @marker = Mapper.placeVehicleMarker(this)
  remove: ->
    @marker?.setMap(null)
    @marker = null
class @Alert
  constructor: (@text) ->
    @timestamp = new Date()
  matches: (text) ->
    @text is text
  equals: (thing) ->
    this is thing or @matches(thing)

window.templates = {}
window.jsonData = {}

# load templates and JSON before initializing map
$ ->
  compileTemplates = (compiledCallback) ->
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
    async.map ['all_stops', 'google_style', 'route_coordinates', 'routes_by_line'],
      (jsonName, callback) ->
        $.get "js/json/#{jsonName}.json", (data) ->
          window.jsonData[jsonName] = if typeof data is 'object' then data else JSON.parse(data)
          callback()
      (error, success) ->
        if error
          loadedCallback("FATAL: Could not load JSON. #{error}")
        else
          Helpers.events.fire('json-loaded')
          loadedCallback()
  async.map [loadJson, compileTemplates],
    (prepFunction, callback) ->
      prepFunction(callback)
    (error, success) ->
      if error
        console.log(error)
      else
        Helpers.events.fire('prep-complete')
