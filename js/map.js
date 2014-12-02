var app = (function(){
	var self = {
		getUserLocation: function(callback){
			if (navigator.geolocation){
				navigator.geolocation.getCurrentPosition(function(pos){
					callback(pos.coords);
				}, function(error){
					switch(error.code){
						case error.PERMISSION_DENIED:
							console.log("Let me see where you are!");
							break;
						case error.POSITION_UNAVAILABLE:
							console.log("No info");
							break;
						case error.TIMEOUT:
							console.log("Took too long");
							break;
						case error.UNKNOWN_ERROR:
							console.log("WHAT DID YOU DO");
							break;
					}
				});
			} else {
				console.log("No geolocation in this browser.");
			}
		}
	};
	return self;
}());

var mbta = (function(){
	var apiUrl = "http://realtime.mbta.com/developer/api/v2/";
	
	function makeApiRequest(path, additionalParams, callback, errorCallback){
		var params = {
			api_key: 'dHl1-NB5RUSVzujwXXlDZg'
		};

		additionalParams = additionalParams || {};
		errorCallback = errorCallback || function(thrown){
			console.log(thrown);
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
		trainLocsUpdateIntervalObject: null,
		initialize: function(){
			self.getAllRoutes(function(result){
				var allStops = {};
				var routeLatLons = {};
				var callsMade = 0;
				var callsCompleted = 0;

				function finalize(){
					stopsAsArray = [];
					for(var stop in allStops){
						stopsAsArray.push(allStops[stop]);
					}
					console.log(stopsAsArray);

					routeLatLonsArrayed = {};
					for (var route in routeLatLons){
						routeLatLonsArrayed[route] = [];
						for (var stop in routeLatLons[route]){
							routeLatLonsArrayed[route].push(routeLatLons[route][stop]);
						}
					}
					console.log(routeLatLonsArrayed);
				}

				function buildStop(i, route){
					callsMade++;
					self.getStopsByRoute(route.route_id, function(result){
						routeLatLons[route.route_name] = routeLatLons[route.route_name] || {};

						$.each(result.direction, function(i, dir){
							$.each(dir.stop, function(i, stop){
								allStops[stop.parent_station] = allStops[stop.parent_station] ||
									{
										id: stop.parent_station,
										name: stop.parent_station_name,
										line: route.route_name,
										lat: parseFloat(stop.stop_lat),
										lng: parseFloat(stop.stop_lon),
										order: parseInt(stop.stop_order)
									};

								routeLatLons[route.route_name][stop.parent_station] = 
									routeLatLons[route.route_name][stop.parent_station] ||
									{
										lat: parseFloat(stop.stop_lat),
										lng: parseFloat(stop.stop_lon),
										order: parseInt(stop.stop_order)
									};
							});
						});
						callsCompleted++;

						if (callsMade === callsCompleted){
							finalize();
						}
					});
				}

				$.each(result.mode[0].route, buildStop);
				$.each(result.mode[1].route, buildStop);
			});
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
		updateTrainLocations: function(){
			var trainsFound = {};
			var callsMade = 0;
			var callsCompleted = 0;

			function findAllTrains(route){
				callsMade++;
				self.getTrainsByRoute(route.route_id, function(route){
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
					callsCompleted++;

					if (callsMade === callsCompleted){
						refreshTrainMarkers(trainsFound);
					}
				}, function(){
					callsCompleted++;
					if (callsMade === callsCompleted){
						refreshTrainMarkers(trainsFound);
					}
				});
			}

			function refreshTrainMarkers(trains){
				var toRemove = [];
				//update trains that have moved and mark trains that were
				//not found for deletion
				for (var id in self.trainLocations){
					if (trains[id]){
						var newLocation = new google.maps.LatLng(trains[id].lat, trains[id].lng);
						self.trainLocations[id].setPosition(newLocation);
						var newIcon = self.trainLocations[id].icon;
						newIcon.rotation = trains[id].bearing;
						self.trainLocations[id].setIcon(newIcon);
					} else {
						toRemove.push(id);
					}
				}

				//add newly-started trains
				for (var id in trains){
					if (!self.trainLocations[id]){
						self.trainLocations[id] = mapper.placeVehicleMarker(trains[id]);
					}
				}

				//remove any missing trains
				for (var i = 0; i < toRemove.length; i++){
					self.trainLocations[toRemove[i]].setMap(null);
				}
			}

			self.getAllRoutes(function(results){
				$.each(results.mode[0].route, function(i, route){
					findAllTrains(route);
				});
				$.each(results.mode[1].route, function(i, route){
					findAllTrains(route);
				});
			});
		},
		getNextTrainsToStop: function(stop, direction, callback){
			var toReturn = [];
			var requestsMade = 0;
			var requestsCompleted = 0;

			console.log(stop);

			makeApiRequest('predictionsbystop', {stop: stop}, function(result){
				callback(result);
			});

			// for (var i = 0; i < direction.substops.length; i++){
			// 	requestsMade++;
			// 	(function(i){
			// 		makeApiRequest('predictionsbystop', {stop: stop.name},
			// 			function(result){
			// 				$.each(result.mode[0].route, function(i, route){
			// 					var nextTrain = route.direction[0].trip[0];
			// 					var eta = new Date(parseInt(nextTrain.pre_dt) * 1000);
			// 					toReturn.push(new Train(
			// 						nextTrain.trip_headsign,
			// 						eta,
			// 						helpers.dateToTime(eta)));
			// 				});

			// 				requestsCompleted++;
			// 				if (requestsCompleted === requestsMade){
			// 					callback(toReturn);
			// 				}
			// 			},
			// 			function(error){
			// 				callback(error, true);
			// 			}
			// 		);
			// 	}(i));
			// }
		}
	};

	return self;
}());

var mapper = (function(){
	var self = {
		map: null,
		center: {lat: 42.358, lng: -71.064},
		zoom: 14,
		initialize: function(){
			self.map = new google.maps.Map(document.getElementById('viewport'), {
				center: self.center,
				zoom: self.zoom,
				styles: mapStyle,
				backgroundColor: '#2a2a2a'
			});

			self.placeStopMarkers(allStops);
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
				icon: marker.icon || helpers.getIcon(marker),
				stop: marker.stop
			});

			gMarker.infoWindow = new InfoWindow(self.map, marker, gMarker)

			google.maps.event.addListener(gMarker, 'click', function(){
				this.infoWindow.open();
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
		}
	};
	return self;
}());

var ui = (function(){
	var alertMsgSelector = "#alert-message";
	var alertSwitchLengthMs = 2000;
	var self = {
		initialize: function(){
			self.bindToggles();
		},
		bindToggles: function(){
			$('[data-toggle]').click(function(){
				var target = $(this).attr('data-toggle');

				$('#' + target).slideToggle();
				$(this).toggleClass("open");
			});
		},
		displayAlert: function(alert, isWarning){
			isWarning = isWarning || false;

			console.log("Displaying " + alert);
			$(alertMsgSelector).fadeOut(function(){
				$(this).html(alert);
				$(this).toggleClass('warning', isWarning);
				$(this).fadeIn();
			});
		},
		displayAlerts: function(alerts){
			$.each(alerts, function(i, a){
				window.setTimeout(alertSwitchLengthMs * i, function(){
					self.displayAlert(a);
				});
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