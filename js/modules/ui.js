var ui = (function(){
    var alertMsgSelector = '#alert-message';
    var modalSelector = '#modal-info';
    var modalWrapperSelector = '#modal-info-wrapper';
    var modalSlideTransitionMs = 500;
    var alertSwitchLengthMs = 2000;
    var self = {
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
        initialize: function(){
            self.bindButtons();
            self.bindToggles();

            helpers.events.bind('mapper-mbta-alerts', self.displayAlerts);

            helpers.events.bind('mapper-mbta-predictions', function(predictions){
                self.displayModal('predictionInfo', predictions);
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
        },
        bindToggles: function(){
            $('[data-toggle]').click(function(){
                var target = $(this).attr('data-toggle');

                $('#' + target).slideToggle();
                $(this).toggleClass('open');
            });
            $('[data-close]').click(function(){
                var target = $(this).attr('data-close');
                $('#' + target).removeClass('visible');

                var eventName = $(this).attr('data-close-event');
                helpers.events.fire(eventName);
            });
        },
        displayAlert: function(alert, isWarning){
            isWarning = isWarning || false;

            $(alertMsgSelector).fadeOut(function(){
                $(this).html(alert);
                $(this).toggleClass('warning', isWarning);
                $(this).fadeIn();
            });
        },
        displayAlerts: function(alerts){
            $.each(alerts, function(i, a){
                window.setTimeout(function(){
                    self.displayAlert(a);
                }, alertSwitchLengthMs * i);
            });
        },
        displayModal: function(templateName, dataObject){
            $(modalWrapperSelector).removeClass('visible');
            setTimeout(function(){
                $(modalSelector).html(templates[templateName](dataObject));
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