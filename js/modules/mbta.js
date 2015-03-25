var mbta = (function(){
    var apiUrl = 'http://realtime.mbta.com/developer/api/v2/';

    //todo replace this with superagent
    function makeApiRequest(path, additionalParams, callback, errorCallback, triggerStatusEvents){
        var params = {
            api_key: 'dHl1-NB5RUSVzujwXXlDZg'
        };

        additionalParams = additionalParams || {};
        triggerStatusEvents = typeof triggerStatusEvents !== 'undefined' ? triggerStatusEvents : true;

        for (var param in additionalParams){
            params[param] = additionalParams[param];
        }

        if (triggerStatusEvents){
            helpers.events.fire('mbta-api-sent');
        }

        $.ajax(apiUrl + path, {
            data: params,
            success: function(data){
                if (triggerStatusEvents){
                    helpers.events.fire('mbta-api-completed', data);
                }
                callback(data);
            },
            error: function(xhr, status, thrown){
                if (triggerStatusEvents){
                    helpers.events.fire('mbta-api-error', thrown);
                }
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
            makeApiRequest('vehiclesbyroute', {route: routeName}, callback, errorCallback, false);
        },
        updateVehicleLocations: function(routes){
            var trainsFound = {};

            helpers.events.fire('mbta-api-sent');

            var atLeastOneSucceeded = false;

            async.map(routes, function(route, callback){
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

                    atLeastOneSucceeded = true;

                    callback(null, null);
                }, function(){
                    callback(null, null);
                });
            }, function(){
                //remove all trains
                for (train in self.trainLocations){
                    self.trainLocations[train].setMap(null);
                }
                self.trainLocations = {};

                //add new trains
                for (var id in trainsFound){
                    self.trainLocations[id] = mapper.placeVehicleMarker(trainsFound[id]);
                }

                if (atLeastOneSucceeded){
                    helpers.events.fire('mbta-api-completed');
                } else {
                    helpers.events.fire('mbta-api-error', 'Could not fetch train locations.');
                }
            });
        },
        getNextTrainsToStop: function(stop, callback, errorCallback){
            makeApiRequest('predictionsbystop', {stop: stop}, callback, errorCallback);
        }
    };
    return self;
}());