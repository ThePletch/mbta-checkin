var mapper = (function(){
    var click = {
        stopMarker: function(marker){
            self.markStopSelected(marker);
            mbta.getNextTrainsToStop(marker.id, function(result){
                helpers.events.fire('mapper-mbta-alerts', result.alert_headers.map(function(a){ return a.header_text; }));

                $.each(result.mode, function(i, mode){
                    $.each(mode.route, function(j, route){
                        route.route_name += ' (' + route.direction[0].trip[0].trip_headsign + ')';

                        $.each(route.direction, function(k, dir){
                            var sum_time_between = 0;
                            var last_trip_scheduled = -1;
                            $.each(dir.trip, function(l, trip){
                                if (last_trip_scheduled !== -1){
                                    sum_time_between += parseInt(trip.pre_dt) - last_trip_scheduled;
                                }
                                else{
                                    sum_time_between += parseInt(trip.pre_away);
                                }
                                last_trip_scheduled = parseInt(trip.pre_dt);
                            });

                            dir.time_between_trains = Math.round((sum_time_between/dir.trip.length)/60) + "m";

                            dir.predict_str = helpers.dateToTime(new Date(parseInt(dir.trip[0].pre_dt) * 1000));
                            dir.away_str = helpers.secondsToTimeString(parseInt(dir.trip[0].pre_away));
                            dir.vehicle_name = helpers.vehicleName(mode.mode_name);
                        });
                    });
                });

                helpers.events.fire('mapper-mbta-predictions', result);

                self.markSelectedStopState('success');
            }, function(error){
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
                backgroundColor: '#2a2a2a',
                disableDefaultUI: true
            });

            helpers.events.bind('modal-closed', function(){
                self.removeSelected();
            });

            helpers.events.bind('ui-location-found', self.zoomToLocation);

            self.placeStopMarkers(allStops);
            self.drawLineShapes();
        },
        drawLineShapes: function(){
            $.get("shapes/route_shapes.json", function(data){
                var routes = (typeof data == String) ? JSON.parse(data) : data;
                for (var i = 0; i < routes.length; i++){
                    for (var j = 0; j < routes[i].shapes.length; j++){
                        self.mapShapeFromLatLonList(routes[i].shapes[j], "#" + routes[i].color);
                    }
                }
            });
        },
        mapShapeFromLatLonList: function(latLonList, color){
            var polyPoints = [];
            $.each(latLonList, function(i, a){
                var point = {lat: a.lat, lng: a.lon};
                polyPoints.push(point);
            });
            var path = new google.maps.Polyline({
                path: polyPoints,
                strokeColor: color,
                strokeOpacity: 1.0,
                strokeWeight: 5
            });
            path.setMap(self.map);
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
        },
        zoomToLocation: function(location){
            self.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude));
            self.map.setZoom(16);
        }
    };
    return self;
}());