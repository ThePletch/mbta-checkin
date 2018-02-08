class @Ui
  @modal:
    selector: '#modal-info'
    wrapperSelector: '#modal-info-wrapper'
    slideTransitionMs: 500

  @maxAlertsCount: 10
  @alerts: []
  @statusIndicator:
    selector: '#status-indicator'
    setStatus: (status, tooltip) ->
      newImg = switch status
        when 'loading' then Helpers.iconUrls.statusLoading
        when 'error' then Helpers.iconUrls.statusError
        when 'success' then Helpers.iconUrls.statusSuccess
        else '?'
      $(Ui.statusIndicator.selector).attr('src', newImg)
      $(Ui.statusIndicator.selector).attr('title', tooltip || '')

  @swipeHandler:
    viewport:
      selector: 'slide-pane'
    modal:
      selector: 'modal-info-wrapper'
    slider:
      selector: 'ui-slider'
    leftArrow:
      selector: 'larrow'
    rightArrow:
      selector: 'rarrow'
    button:
      size: 200
      defaultIndex: 1
    closeDropdownDurationMs: 150

    refreshButtonPosition: ->
      handler = Ui.swipeHandler

      slideButtons = ->
        # Move button slider to show current button
        $("##{handler.slider.selector}").css('margin-left',
          -1 * handler.button.index * handler.button.size)
        updateArrowDisplay(handler.button.index)

      updateArrowDisplay = (index) ->
        $("##{handler.leftArrow.selector}, ##{handler.rightArrow.selector}").removeClass('hidden')
        if index == 0
          $("##{handler.leftArrow.selector}").addClass('hidden')
        if index == handler.button.count - 1
          $("##{handler.rightArrow.selector}").addClass('hidden')


      openDropdown = $("##{handler.slider.selector} .ui-dropdown.open")
      if openDropdown.length
        openDropdown.removeClass('open')
        openDropdown.slideUp(handler.closeDropdownDurationMs, slideButtons)
      else
        slideButtons()

    initialize: ->
      handler = Ui.swipeHandler

      viewportSwiper = new Hammer(document.getElementById(handler.viewport.selector))
      viewportSwiper.get('swipe').set
        direction: Hammer.DIRECTION_ALL

      modalSwiper = new Hammer(document.getElementById(handler.modal.selector))

      handler._viewport = viewportSwiper
      handler._modal = modalSwiper
      handler.button.count = $("##{handler.slider.selector} .ui-element").length
      handler.button.index = handler.button.defaultIndex

      handler.refreshButtonPosition()

      viewportSwiper.on 'swipeleft swiperight swipedown', (e) ->
        switch e.type
          when 'swiperight' then handler.vSwipeRight()
          when 'swipeleft' then handler.vSwipeLeft()
          when 'swipedown' then refreshButtonPosition()

      modalSwiper.on 'swiperight', (e) -> handler.mSwipeRight()
      $("##{handler.rightArrow.selector}").click(handler.vSwipeLeft)
      $("##{handler.leftArrow.selector}").click(handler.vSwipeRight)

    alert: (direction) ->
      switch direction
        when 'left' then $("##{Ui.swipeHandler.leftArrow.selector}").addClass('alert')
        when 'right' then $("##{Ui.swipeHandler.rightArrow.selector}").addClass('alert')

    clearAlert: (direction) ->
      switch direction
        when 'left' then $("##{Ui.swipeHandler.leftArrow.selector}").removeClass('alert')
        when 'right' then $("##{Ui.swipeHandler.rightArrow.selector}").removeClass('alert')

    mSwipeRight: ->
      Ui.closeElement('modal-info-wrapper', 'modal-closed')

    vSwipeRight: ->
      handler = Ui.swipeHandler
      handler.button.index = Math.max(handler.button.index - 1, 0)
      handler.refreshButtonPosition()

    vSwipeLeft: ->
      handler = Ui.swipeHandler
      handler.button.index = Math.min(handler.button.index + 1, handler.button.count - 1)
      handler.refreshButtonPosition()

  @initialize: ->
    Ui.bindButtons()
    Ui.bindToggles()

    Helpers.events.bind('mbta-new-alerts', Ui.displayAlerts)

    Helpers.events.bind 'mbta-predictions', (predictions) ->
      Ui.displayModal('prediction-info', predictions)

    Helpers.events.bind ['mbta-api-sent', 'native-api-sent'], ->
      Ui.statusIndicator.setStatus('loading')

    Helpers.events.bind ['mbta-api-completed', 'native-api-completed'], ->
      Ui.statusIndicator.setStatus('success')

    Helpers.events.bind ['mbta-api-error', 'native-api-error'], (error) ->
      Ui.statusIndicator.setStatus('error', error)

    Helpers.events.bind 'ui-new-alert', ->
      Ui.swipeHandler.alert('right')
      $('#alerts').addClass('error')

  @bindButtons: ->
    $('#zoom-location').click(Ui.fetchUserLocation)

    $('#alerts').click ->
      $('#alerts').removeClass('error')
      Ui.swipeHandler.clearAlert('right')
      Ui.displayModal 'alerts',
        alerts: Ui.alerts

    Ui.swipeHandler.initialize()

  @bindToggles: ->
    $('[data-toggle]').click ->
      target = $(this).attr('data-toggle')
      jqTarget = $("##{target}")

      jqTarget.slideToggle()
      jqTarget.toggleClass('open')
    $('[data-close]').click ->
      jqThis = $(this)
      target = $(this).attr('data-close')
      eventName = $(this).attr('data-close-event')
      Ui.closeElement(target, eventName)

  @bindModalButtons: ->
    $('.track-route').click ->
      window.buttonClicked = this
      routeId = $(this).attr('data-route-id')
      Mbta.updateVehicleLocations(Helpers.cache.routes[routeId])
      Ui.closeElement('modal-info-wrapper', 'modal-closed')

  @closeElement: (target, eventName) ->
    $("##{target}").removeClass('visible')
    Helpers.events.fire(eventName)

  @displayAlert: (alertText, isWarning) ->
    return false if Ui.alertAlreadyDisplayed(alertText)

    Ui.alerts.unshift(new Alert(alertText))

    if Ui.alerts.length > Ui.maxAlertsCount
      Ui.alerts.pop()

    Helpers.events.fire('ui-new-alert')

  @displayAlerts: (alerts) ->
    _.map(alerts, Ui.displayAlert)

  @alertAlreadyDisplayed: (alertText) ->
    !!_.find Ui.alerts, (alert) ->
      alert.equals(alertText)

  @displayModal: (templateName, dataObject) ->
    $(Ui.modal.wrapperSelector).removeClass('visible')
    setTimeout ( ->
      templateMarkup = templates[templateName].render(dataObject)

      $(Ui.modal.selector).html(templateMarkup)
      $(Ui.modal.wrapperSelector).addClass('visible')
      Ui.bindModalButtons()
    ), Ui.modal.slideTransitionMs

  @fetchUserLocation: ->
    App.getUserLocation()
