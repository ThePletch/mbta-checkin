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