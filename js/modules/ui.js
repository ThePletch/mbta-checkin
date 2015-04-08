var ui = (function(){
    var modalSelector = '#modal-info';
    var modalWrapperSelector = '#modal-info-wrapper';
    var modalSlideTransitionMs = 500;
    var maxAlertsCount = 10;
    var self = {
        alerts: [],
        statusIndicator: {
            selector: '#status-indicator',
            setStatus: function(status, tooltip){
                var newImg = '';
                switch (status){
                    case 'loading':
                        newImg = helpers.iconUrls.statusLoading;
                        break;
                    case 'error':
                        newImg = helpers.iconUrls.statusError;
                        break;
                    case 'success':
                        newImg = helpers.iconUrls.statusSuccess;
                        break;
                    default:
                        newImg = '?';
                        break;
                }
                $(self.statusIndicator.selector).attr('src', newImg);
                $(self.statusIndicator.selector).attr('title', tooltip || '');
            }
        },
        swipeHandler: (function($){
            var viewportSelector = 'slide-pane';
            var modalSelector = 'modal-info-wrapper';
            var sliderSelector = 'ui-slider';
            var leftArrowSelector = 'larrow';
            var rightArrowSelector = 'rarrow';
            var buttonSize = 200;
            var defaultButtonIndex = 1;
            var closeDropdownDurationMs = 150;

            var refreshButtonPosition = function(){
                var slideButtons = function(){
                    $('#' + sliderSelector).css('margin-left', -1 * handler.buttonIndex * buttonSize);
                    $('#' + leftArrowSelector + ', #' + rightArrowSelector).removeClass('hidden');
                    if (handler.buttonIndex === 0){
                        $('#' + leftArrowSelector).addClass('hidden');
                    }

                    if (handler.buttonIndex === handler.buttonCount - 1){
                        $('#' + rightArrowSelector).addClass('hidden');
                    }
                };

                var openDropdown = $('#' + sliderSelector + ' .ui-dropdown.open');
                if (openDropdown.length > 0){
                    openDropdown.removeClass('open');
                    openDropdown.slideUp(closeDropdownDurationMs, slideButtons);
                } else {
                    slideButtons();
                }
            };

            var handler = {
                initialize: function(){
                    var viewportSwiper = new Hammer(document.getElementById(viewportSelector));
                    viewportSwiper.get('swipe').set({direction: Hammer.DIRECTION_ALL});
                    var modalSwiper = new Hammer(document.getElementById(modalSelector));
                    handler._viewport = viewportSwiper;
                    handler._modal = modalSwiper;
                    handler.buttonCount = $('#' + sliderSelector + ' .ui-element').length;
                    handler.buttonIndex = defaultButtonIndex;
                    refreshButtonPosition();
                    viewportSwiper.on('swipeleft swiperight swipedown', function(e){
                        switch(e.type){
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
                    modalSwiper.on('swiperight', function(e){
                        handler.mSwipeRight();
                    });
                    $("#" + rightArrowSelector).click(handler.vSwipeLeft);
                    $("#" + leftArrowSelector).click(handler.vSwipeRight);
                },
                alert: function(direction){
                    switch(direction){
                        case 'left':
                            $('#' + leftArrowSelector).addClass('alert');
                            break;
                        case 'right':
                            $('#' + rightArrowSelector).addClass('alert');
                    }
                },
                clearAlert: function(direction){
                    switch(direction){
                        case 'left':
                            $('#' + leftArrowSelector).removeClass('alert');
                            break;
                        case 'right':
                            $('#' + rightArrowSelector).removeClass('alert');
                    }
                },
                mSwipeRight: function(){
                    self.closeElement('modal-info-wrapper', 'modal-closed');
                },
                vSwipeRight: function(){
                    handler.buttonIndex = Math.max(handler.buttonIndex - 1, 0);
                    refreshButtonPosition();
                },
                vSwipeLeft: function(){
                    handler.buttonIndex = Math.min(handler.buttonIndex + 1, handler.buttonCount - 1);
                    refreshButtonPosition();
                }
            };

            return handler;
        }($)),
        initialize: function(){
            self.bindButtons();
            self.bindToggles();

            helpers.events.bind('mapper-mbta-alerts', self.displayAlerts);

            helpers.events.bind('mapper-mbta-predictions', function(predictions){
                self.displayModal('prediction-info', predictions);
            });

            helpers.events.bind('mbta-api-sent', function(){
                self.statusIndicator.setStatus('loading');
            });

            helpers.events.bind('mbta-api-completed', function(){
                self.statusIndicator.setStatus('success');
            });

            helpers.events.bind('mbta-api-error', function(error){
                self.statusIndicator.setStatus('error', error);
            });

            helpers.events.bind('ui-new-alert', function(){
                self.swipeHandler.alert('right');
                $('#alerts').addClass('error');
            });
        },
        bindButtons: function(){
            $('#zoom-location').click(self.fetchUserLocation);
            $('#update-blue').click(function(){
                mbta.updateVehicleLocations(routesByLine['Blue Line']);
                helpers.events.fire('blue-updated');
            });
            $('#update-green').click(function(){
                mbta.updateVehicleLocations(routesByLine['Green Line']);
                helpers.events.fire('green-updated');
            });
            $('#update-orange').click(function(){
                mbta.updateVehicleLocations(routesByLine['Orange Line']);
                helpers.events.fire('orange-updated');
            });
            $('#update-red').click(function(){
                mbta.updateVehicleLocations(routesByLine['Red Line']);
                helpers.events.fire('red-updated');
            });
            $('#alerts').click(function(){
                $('#alerts').removeClass('error');
                self.swipeHandler.clearAlert('right');
                self.displayModal('alerts', {alerts: self.alerts});
            });
            self.swipeHandler.initialize();
        },
        bindToggles: function(){
            $('[data-toggle]').click(function(){
                var target = $(this).attr('data-toggle');

                $('#' + target).slideToggle();
                $('#' + target).toggleClass('open');
            });
            $('[data-close]').click(function(){
                var target = $(this).attr('data-close');
                var eventName = $(this).attr('data-close-event');
                self.closeElement(target, eventName);
            });
        },
        closeElement: function(target, eventName){
            $('#' + target).removeClass('visible');
            helpers.events.fire(eventName);
        },
        displayAlert: function(alert, isWarning){
            if (self.alerts.indexOf(alert) !== -1){
                return false;
            }

            self.alerts.unshift({text: alert});
            if (self.alerts.length > maxAlertsCount){
                self.alerts.pop();
            }

            helpers.events.fire('ui-new-alert');
        },
        displayAlerts: function(alerts){
            _.map(alerts, self.displayAlert);
        },
        displayModal: function(templateName, dataObject){
            $(modalWrapperSelector).removeClass('visible');
            setTimeout(function(){
                $(modalSelector).html(templates[templateName].render(dataObject));
                $(modalWrapperSelector).addClass('visible');
            }, modalSlideTransitionMs);
        },
        fetchUserLocation: function(){
            app.getUserLocation(function(result){
                helpers.events.fire('ui-location-found', result);
            });
        }
    };
    return self;
}());