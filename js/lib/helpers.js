Number.prototype.leftPad = function(len, padder){
    var s = this.toString(),
        padder = padder || '0';

    while(s.length < len){
        s = padder + s;
    }

    return s;
};

var helpers = {
    events: (function(){
        var self = {
            _ev: {},
            bind: function(eventName, func){
                self._ev[eventName] = self._ev[eventName] || [];
                self._ev[eventName].push(func);
            },
            fire: function(eventName, params){
                if (!self._ev[eventName]){
                    // swallows error if event is fired with no bindings
                    return;
                }

                $.each(self._ev[eventName], function(i, func){
                    func(params);
                });
            }
        };

        return self;
    }()),
    iconUrls: {
        red: 'img/red_line.png',
        green: 'img/green_line.png',
        blue: 'img/blue_line.png',
        orange: 'img/orange_line.png',
        redGreen: 'img/red_green_line.png',
        redOrange: 'img/red_orange_line.png',
        orangeBlue: '',
        blueGreen: 'img/green_blue_line.png',
        orangeGreen: 'img/orange_green_line.png',
        selected: 'img/selected.png',
        selectedError: 'img/selected_error.png',
        selectedSuccess: 'img/selected_success.png',
        statusLoading: 'img/spinner.gif',
        statusSuccess: 'img/success.png',
        statusError: 'img/error.png'
    },
    // these colors control the color of live train icons
    // and the color of line overlays
    lineColors: {
        red: '#ff0000',
        green: '#00ff00',
        blue: '#0077cc',
        orange: '#ff8800'
    },
    getLineColor: function(lineColor){
        switch(lineColor){
            case 'Green Line':
            case 'Green Line B':
            case 'Green Line C':
            case 'Green Line D':
            case 'Green Line E':
                return helpers.lineColors.green;
            case 'Orange Line':
                return helpers.lineColors.orange;
            case 'Blue Line':
                return helpers.lineColors.blue;
            case 'Red Line':
            case 'Mattapan Trolley':
                return helpers.lineColors.red;
        }
    },
    getLineIcon: function(lineColor){
        switch(lineColor){
            case 'Green Line':
            case 'Green Line B':
            case 'Green Line C':
            case 'Green Line D':
            case 'Green Line E':
                return helpers.iconUrls.green;
            case 'Orange Line':
                return helpers.iconUrls.orange;
            case 'Blue Line':
                return helpers.iconUrls.blue;
            case 'Red Line':
            case 'Mattapan Trolley':
                return helpers.iconUrls.red;
        }
    },
    getLiveIcon: function(train){
        var toReturn = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: helpers.getLineColor(train.line),
            fillOpacity: 1,
            rotation: train.bearing,
            scale: 4,
            strokeWeight: 1
        };

        return toReturn;
    },
    getIcon: function(icon){
        var toReturn = {
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12),
            url: helpers.getLineIcon(icon.line)
        };

        return toReturn;
    },
    dateToTime: function(date){
        var hours = (date.getHours() - 1) % 12 + 1;
        var minutes = date.getMinutes().leftPad(2);
        var amPm = (date.getHours() >= 12) ? 'pm' : 'am';

        return hours + ':' + minutes + ' ' + amPm;
    },
    secondsToTimeString: function(time){
        var minutes = Math.floor(time/60);

        if (minutes > 0){
            return minutes + ' mins';
        } else {
            return 'Arr';
        }
    },
    vehicleName: function(modeName){
        var vehicleNameMap = {
            'Subway': 'trains',
            'Bus': 'buses',
            'Commuter Rail': 'trains'
        };

        return vehicleNameMap[modeName];
    }
};

function Template(name, compiledCallback){
    var self = this;
    this.compiled = false;
    this._template = null;

    var setCompiledData = function(data){
        self._template = data;
        self.compiled = true;
    };

    $.get('hb/' + name + '.hdbs', function(data){
        setCompiledData(Handlebars.compile(data));
        compiledCallback();
    });


    this.render = function(context){
        if (this.compiled){
            return this._template(context);
        } else {
            return false;
        }
    };
}

function Stop(lat, lng, name, directions){
    this.lat = lat;
    this.lng = lng;
    this.name = name;
    this.directions = directions || {};

    this.getIcon = function(){
        helpers.getIcon(this);
    };
}

function Direction(name, substops){
    this.name = name;
    this.substops = substops || [];
}

function Substop(id, name, line){
    this.id = id;
    this.name = name;
    this.line = line;
}

function Train(name, eta, etaString){
    this.name = name;
    this.eta = eta;
    this.etaString = etaString;
}

function LiveTrain(id, line, destination, lat, lng, bearing){
    this.id = id;
    this.line = line;
    this.destination = destination;
    this.lat = lat;
    this.lng = lng;
    this.bearing = bearing;
}

var templates = {};

$(function(){
    async.map(['prediction-info', 'alerts'], function(templateName, callback){
        templates[templateName] = new Template(templateName, function(){
            callback();
        });
    }, function(error, success){
        if (!error){
            helpers.events.fire('templates-rendered');
        }
    });
});