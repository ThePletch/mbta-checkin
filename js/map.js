var app = (function(){
    var self = {
        getUserLocation: function(callback){
            if (navigator.geolocation){
                navigator.geolocation.getCurrentPosition(function(pos){
                    callback(pos.coords);
                }, function(error){
                    switch(error.code){
                        case error.PERMISSION_DENIED:
                            ui.displayAlert('Denied request to geolocate user', true);
                            break;
                        case error.POSITION_UNAVAILABLE:
                            ui.displayAlert('Could not detect user location', true);
                            break;
                        case error.TIMEOUT:
                            ui.displayAlert('Attempt to find user timed out', true);
                            break;
                        case error.UNKNOWN_ERROR:
                            ui.displayAlert('Unknown error in geolocation', true);
                            break;
                    }
                });
            } else {
                ui.displayAlert('Your browser does not support geolocation', true);
            }
        }
    };
    return self;
}());

var mbta = (function(){
    var apiUrl = 'http://realtime.mbta.com/developer/api/v2/';
    
    function makeApiRequest(path, additionalParams, callback, errorCallback){
        var params = {
            api_key: 'dHl1-NB5RUSVzujwXXlDZg'
        };

        additionalParams = additionalParams || {};
        errorCallback = errorCallback || function(thrown){
            ui.displayAlert(thrown, true);
        };

        for (var param in additionalParams){
            params[param] = additionalParams[param];
        }

        $.ajax(apiUrl + path, {
            data: params,
            success: callback,
            error: function(xhr, status, thrown){
                errorCallback(thrown);
            }
        });
    }

    var self = {
        allStops: allStops,
        trainLocations: {},
        initialize: function(){
        },
        getAllRoutes: function(callback){
            makeApiRequest('routes', null, callback);
        },
        getRouteByStop: function(stopName, callback){
            makeApiRequest('routesbystop', {stop: stopName}, callback);
        },
        getStopsByRoute: function(routeName, callback){
            makeApiRequest('stopsbyroute', {route: routeName}, callback);
        },
        getTrainsByRoute: function(routeName, callback, errorCallback){
            makeApiRequest('vehiclesbyroute', {route: routeName}, callback, errorCallback);
        },
        updateTrainLocations: function(routes){
            ui.displayAlert('Fetching train locations...');
            var trainsFound = {};
            var callsMade = 0;
            var callsCompleted = 0;

            function completeCall(){
                callsCompleted++;
                if (callsMade === callsCompleted){
                    refreshTrainMarkers(trainsFound);
                    ui.displayAlert('Train locations updated.');
                }
            }

            function findAllTrains(route){
                callsMade++;
                self.getTrainsByRoute(route, function(route){
                    $.each(route.direction, function(j, dir){
                        $.each(dir.trip, function(k, trip){
                            var vehicle = trip.vehicle;

                            var train = new LiveTrain(
                                vehicle.vehicle_id,
                                route.route_name,
                                trip.trip_headsign,
                                parseFloat(vehicle.vehicle_lat),
                                parseFloat(vehicle.vehicle_lon),
                                parseInt(vehicle.vehicle_bearing));

                            trainsFound[vehicle.vehicle_id] = train;
                        });
                    });
                    
                    completeCall();
                }, completeCall);
            }

            function refreshTrainMarkers(trains){
                //remove all trains
                for (train in self.trainLocations){
                    self.trainLocations[train].setMap(null);
                }
                self.trainLocations = {};

                //add new trains
                for (var id in trains){
                    self.trainLocations[id] = mapper.placeVehicleMarker(trains[id]);
                }
            }

            $.each(routes, function(i, route){
                findAllTrains(route);
            });
        },
        getNextTrainsToStop: function(stop, callback, errorCallback){
            var toReturn = [];
            var requestsMade = 0;
            var requestsCompleted = 0;

            makeApiRequest('predictionsbystop', {stop: stop}, callback, errorCallback);
        }
    };

    return self;
}());

var mapper = (function(){
    var click = {
        stopMarker: function(marker){
            self.markStopSelected(marker);
            mbta.getNextTrainsToStop(marker.id, function(result){
                //show any alerts sent in alert ticker
                ui.displayAlerts(result.alert_headers.map(function(a){
                    return a.header_text;
                }));

                $.each(result.mode, function(i, mode){
                    $.each(mode.route, function(j, route){
                        route.route_name += ' (' + route.direction[0].trip[0].trip_headsign + ')';

                        $.each(route.direction, function(k, dir){
                            dir.predict_str = helpers.dateToTime(new Date(parseInt(dir.trip[0].pre_dt) * 1000));
                            dir.away_str = helpers.secondsToTimeString(parseInt(dir.trip[0].pre_away));
                        });
                    });
                });

                ui.displayModal('predictionInfo', result);
                self.markSelectedStopState('success');
            }, function(error){
                ui.displayAlert(error, true);
                self.markSelectedStopState('error');
            });
        }
    };

    var self = {
        map: null,
        center: {lat: 42.358, lng: -71.064},
        selected: null,
        zoom: 14,
        initialize: function(){
            self.map = new google.maps.Map(document.getElementById('viewport'), {
                center: self.center,
                zoom: self.zoom,
                styles: mapStyle,
                backgroundColor: '#2a2a2a'
            });

            helpers.events.bind('modal-closed', function(){
                self.removeSelected();
            });

            self.placeStopMarkers(allStops);
        },
        markSelectedStopState: function(state){
            var iconUrl;
            switch (state){
                case 'error':
                    iconUrl = helpers.iconUrls.selectedError;
                    break;
                case 'success':
                    iconUrl = helpers.iconUrls.selectedSuccess;
                    break;
            }

            var currentIcon = self.selected.getIcon();
            currentIcon.url = iconUrl;
            self.selected.setIcon(currentIcon);
        },
        markStopSelected: function(marker){
            console.log(marker);
            //delete any existing selection marker
            if (self.selected){
                self.removeSelected();
            }

            self.selected = new google.maps.Marker({
                position: new google.maps.LatLng(marker.lat, marker.lng),
                map: self.map,
                icon: {
                    url: helpers.iconUrls.selected,
                    scaledSize: new google.maps.Size(33, 33),
                    anchor: new google.maps.Point(16, 16)
                }
            });
        },
        placeVehicleMarker: function(marker){
            var gMarker = new google.maps.Marker({
                position: new google.maps.LatLng(marker.lat, marker.lng),
                map: self.map,
                title: marker.destination,
                icon: marker.icon || helpers.getLiveIcon(marker),
            });

            return gMarker;
        },
        placeStopMarker: function(marker){
            var gMarker = new google.maps.Marker({
                position: new google.maps.LatLng(marker.lat, marker.lng),
                map: self.map,
                title: marker.name,
                icon: marker.icon || helpers.getIcon(marker)
            });
            
            google.maps.event.addListener(gMarker, 'click', function(){
                click.stopMarker(marker);
            });

            return gMarker;
        },
        placeStopMarkers: function(markers, extractor){
            extractor = extractor || function(marker){
                return marker;
            };
            $.each(markers, function(i, marker){
                self.placeStopMarker(extractor(marker));
            });
        },
        removeSelected: function(){
            self.selected.setMap(null);
            self.selected = null;
        }
    };
    return self;
}());

var ui = (function(){
    var alertMsgSelector = '#alert-message';
    var modalSelector = '#modal-info';
    var modalWrapperSelector = '#modal-info-wrapper';
    var modalSlideTransitionMs = 500;
    var alertSwitchLengthMs = 2000;
    var self = {
        initialize: function(){
            self.bindButtons();
            self.bindToggles();
        },
        bindButtons: function(){
            $('#zoom-location').click(self.zoomToUserLocation);
            $('#update-blue').click(function(){
                mbta.updateTrainLocations(routesByLine['Blue Line']);
                helpers.events.fire('blue-updated');
            });
            $('#update-green').click(function(){
                mbta.updateTrainLocations(routesByLine['Green Line']);
                helpers.events.fire('green-updated');
            });
            $('#update-orange').click(function(){
                mbta.updateTrainLocations(routesByLine['Orange Line']);
                helpers.events.fire('orange-updated');
            });
            $('#update-red').click(function(){
                mbta.updateTrainLocations(routesByLine['Red Line']);
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
        zoomToUserLocation: function(){
            app.getUserLocation(function(result){
                console.log(result);
                mapper.map.setCenter(new google.maps.LatLng(result.latitude, result.longitude));
                mapper.map.setZoom(16);
            });
        }
    };
    return self;
}());

$(function(){
    mapper.initialize();
    mbta.initialize();
    ui.initialize();
});