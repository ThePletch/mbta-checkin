const Ui = {
  modal: {
    selector: '#modal-info',
    wrapperSelector: '#modal-info-wrapper',
    slideTransitionMs: 500
  },

  maxAlertsCount: 10,
  alerts: [],
  statusIndicator: {
    selector: '#status-indicator',
    setStatus(status, tooltip) {
      const newImg = (() => {
        switch (status) {
          case 'loading':
            return Helpers.iconUrls.statusLoading;
          case 'error':
            return Helpers.iconUrls.statusError;
          case 'success':
            return Helpers.iconUrls.statusSuccess;
          default:
            return '?';
        }
      })();
      $(Ui.statusIndicator.selector).attr('src', newImg);
      $(Ui.statusIndicator.selector).attr('title', tooltip || '');
    }
  },

  swipeHandler: {
    viewport: {
      selector: 'slide-pane'
    },
    modal: {
      selector: 'modal-info-wrapper'
    },
    slider: {
      selector: 'ui-slider'
    },
    leftArrow: {
      selector: 'larrow'
    },
    rightArrow: {
      selector: 'rarrow'
    },
    button: {
      size: 200,
      defaultIndex: 1
    },
    closeDropdownDurationMs: 150,

    refreshButtonPosition() {
      const handler = Ui.swipeHandler;

      const slideButtons = () => {
        // Move button slider to show current button
        $(`#${handler.slider.selector}`).css('margin-left',
          -1 * handler.button.index * handler.button.size);
        updateArrowDisplay(handler.button.index);
      };

      const updateArrowDisplay = (index) => {
        $(`#${handler.leftArrow.selector}, #${handler.rightArrow.selector}`).removeClass('hidden');
        if (index === 0) {
          $(`#${handler.leftArrow.selector}`).addClass('hidden');
        }
        if (index === handler.button.count - 1) {
          $(`#${handler.rightArrow.selector}`).addClass('hidden');
        }
      };

      const openDropdown = $(`#${handler.slider.selector} .ui-dropdown.open`);
      if (openDropdown.length) {
        openDropdown.removeClass('open');
        openDropdown.slideUp(handler.closeDropdownDurationMs, slideButtons);
      } else {
        slideButtons();
      }
    },

    initialize() {
      const handler = Ui.swipeHandler;

      const viewportSwiper = new Hammer(document.getElementById(handler.viewport.selector));
      viewportSwiper.get('swipe').set({
        direction: Hammer.DIRECTION_ALL
      });

      const modalSwiper = new Hammer(document.getElementById(handler.modal.selector));

      handler._viewport = viewportSwiper;
      handler._modal = modalSwiper;
      handler.button.count = $(`#${handler.slider.selector} .ui-element`).length;
      handler.button.index = handler.button.defaultIndex;

      handler.refreshButtonPosition();

      viewportSwiper.on('swipeleft swiperight swipedown', (e) => {
        switch (e.type) {
          case 'swiperight':
            handler.vSwipeRight();
            break;
          case 'swipeleft':
            handler.vSwipeLeft();
            break;
          case 'swipedown':
            refreshButtonPosition();
            break;
        }
      });

      modalSwiper.on('swiperight', (e) => handler.mSwipeRight());
      $(`#${handler.rightArrow.selector}`).click(handler.vSwipeLeft);
      $(`#${handler.leftArrow.selector}`).click(handler.vSwipeRight);
    },

    alert(direction) {
      switch (direction) {
        case 'left':
          $(`#${Ui.swipeHandler.leftArrow.selector}`).addClass('alert');
          break;
        case 'right':
          $(`#${Ui.swipeHandler.rightArrow.selector}`).addClass('alert');
          break;
      }
    },

    clearAlert(direction) {
      switch (direction) {
        case 'left':
          $(`#${Ui.swipeHandler.leftArrow.selector}`).removeClass('alert');
          break;
        case 'right':
          $(`#${Ui.swipeHandler.rightArrow.selector}`).removeClass('alert');
          break;
      }
    },

    mSwipeRight() {
      Ui.closeElement('modal-info-wrapper', 'modal-closed');
    },

    vSwipeRight() {
      const handler = Ui.swipeHandler;
      handler.button.index = Math.max(handler.button.index - 1, 0);
      handler.refreshButtonPosition();
    },

    vSwipeLeft() {
      const handler = Ui.swipeHandler;
      handler.button.index = Math.min(handler.button.index + 1, handler.button.count - 1);
      handler.refreshButtonPosition();
    }
  },

  initialize() {
    Ui.bindButtons();
    Ui.bindToggles();

    Helpers.events.bind('mbta-new-alerts', Ui.displayAlerts);

    Helpers.events.bind('mbta-predictions', (predictions) => {
      Ui.displayModal('prediction-info', predictions);
    });

    Helpers.events.bind(['mbta-api-sent', 'native-api-sent'], () => {
      Ui.statusIndicator.setStatus('loading');
    });

    Helpers.events.bind(['mbta-api-completed', 'native-api-completed'], () => {
      Ui.statusIndicator.setStatus('success');
    });

    Helpers.events.bind(['mbta-api-error', 'native-api-error'], (error) => {
      Ui.statusIndicator.setStatus('error', error);
    });

    Helpers.events.bind('ui-new-alert', () => {
      Ui.swipeHandler.alert('right');
      $('#alerts').addClass('error');
    });
  },

  bindButtons() {
    $('#zoom-location').click(Ui.fetchUserLocation);

    $('#alerts').click(() => {
      $('#alerts').removeClass('error');
      Ui.swipeHandler.clearAlert('right');
      Ui.displayModal('alerts', {
        alerts: Ui.alerts
      });
    });

    Ui.swipeHandler.initialize();
  },

  bindToggles() {
    $('[data-toggle]').click(function() {
      const target = $(this).attr('data-toggle');
      const jqTarget = $(`#${target}`);

      jqTarget.slideToggle();
      jqTarget.toggleClass('open');
    });
    $('[data-close]').click(function() {
      const jqThis = $(this);
      const target = $(this).attr('data-close');
      const eventName = $(this).attr('data-close-event');
      Ui.closeElement(target, eventName);
    });
  },

  bindModalButtons() {
    $('.track-route').click(async function() {
      window.buttonClicked = this;
      const routeId = $(this).attr('data-route-id');
      const route = await Route.byId(routeId);
      await Mbta.updateVehicleLocations(route);
      Ui.closeElement('modal-info-wrapper', 'modal-closed');
    });
  },

  closeElement(target, eventName) {
    $(`#${target}`).removeClass('visible');
    Helpers.events.fire(eventName);
  },

  displayAlert(alertText, isWarning) {
    if (Ui.alertAlreadyDisplayed(alertText)) {
      return false;
    }

    Ui.alerts.unshift(new Alert(alertText));

    if (Ui.alerts.length > Ui.maxAlertsCount) {
      Ui.alerts.pop();
    }

    Helpers.events.fire('ui-new-alert');
  },

  displayAlerts(alerts) {
    return alerts.map(Ui.displayAlert);
  },

  alertAlreadyDisplayed(alertText) {
    return !!Ui.alerts.find((alert) => {
      return alert.equals(alertText);
    });
  },

  displayModal(templateName, dataObject) {
    $(Ui.modal.wrapperSelector).removeClass('visible');
    setTimeout((() => {
      const templateMarkup = templates[templateName].render(dataObject);

      $(Ui.modal.selector).html(templateMarkup);
      $(Ui.modal.wrapperSelector).addClass('visible');
      Ui.bindModalButtons();
    }), Ui.modal.slideTransitionMs);
  },

  fetchUserLocation() {
    App.getUserLocation();
  }
};

window.Ui = Ui;
