var app = (function(){
	var self = {
		getUserLocation: function(callback){
			if (navigator.geolocation){
				navigator.geolocation.getCurrentPosition(function(pos){
					callback(pos.coords);
				}, function(error){
					switch(error.code){
						case error.PERMISSION_DENIED:
							ui.displayAlert("Denied request to geolocate user", true);
							break;
						case error.POSITION_UNAVAILABLE:
							ui.displayAlert("Could not detect user location", true);
							break;
						case error.TIMEOUT:
							ui.displayAlert("Attempt to find user timed out", true);
							break;
						case error.UNKNOWN_ERROR:
							ui.displayAlert("Unknown error in geolocation", true);
							break;
					}
				});
			} else {
				ui.displayAlert("Your browser does not support geolocation", true);
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
			ui.displayAlert("Fetching train locations...");
			var trainsFound = {};
			var callsMade = 0;
			var callsCompleted = 0;

			function completeCall(){
				callsCompleted++;
				if (callsMade === callsCompleted){
					refreshTrainMarkers(trainsFound);
					ui.displayAlert("Train locations updated.");
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

			$.each(routes, function(i, route){
				findAllTrains(route);
			});
		},
		getNextTrainsToStop: function(stop, callback){
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

			//draw routes
			//for(var route in routeLatLons){
			//	var stopLatLons = routeLatLons[route].map(function(position){
			//		return new google.maps.LatLng(position.lat, position.lng);
			//	});
//
			//	var routeLine = new google.maps.Polyline({
			//		path: stopLatLons,
			//		strokeColor: helpers.getLineColor(route),
			//		strokeWeight: 2
			//	});
//
			//	routeLine.setMap(self.map);
			//}
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
				mbta.getNextTrainsToStop(marker.id, function(result){
					console.log(result);
					var alerts = [];
					$.each(result.mode, function(i, mode){
						alerts.push(mode.mode_name + " info for " + marker.name);
						$.each(mode.route, function(i, route){
							if (mode.route.length > 1){
								alerts.push(route.route_name + " (" + route.direction[0].trip[0].trip_headsign + "):");
							}

							$.each(route.direction, function(i, direction){
								var directionAlert = direction.trip[0].trip_headsign + ": ";

								var predictedTime = new Date(parseInt(direction.trip[0].pre_dt) * 1000);
								var predictedTimeAway = parseInt(direction.trip[0].pre_away);

								directionAlert += helpers.dateToTime(predictedTime);

								//terminal stations don't have time away
								if (predictedTimeAway){
									directionAlert += " (" + helpers.secondsToTimeString(predictedTimeAway) + ")";
								}

								alerts.push(directionAlert);
							});
						});
					});

					

					ui.displayAlerts(alerts);
				});
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
			self.bindButtons();
			self.bindToggles();
		},
		bindButtons: function(){
			$("#zoom-location").click(self.zoomToUserLocation);
			$("#update-blue").click(function(){
				mbta.updateTrainLocations(routesByLine["Blue Line"]);
			});
			$("#update-green").click(function(){
				mbta.updateTrainLocations(routesByLine["Green Line"]);
			});
			$("#update-orange").click(function(){
				mbta.updateTrainLocations(routesByLine["Orange Line"]);
			});
			$("#update-red").click(function(){
				mbta.updateTrainLocations(routesByLine["Red Line"]);
			});
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