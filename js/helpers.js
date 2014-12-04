Number.prototype.leftPad = function(len, padder){
    var s = this.toString(),
    	padder = padder || '0';

    while(s.length < len){
    	s = padder + s;
    }

    return s;
};

var helpers = {
	iconUrls: {
		red: 'img/red_line.png',
		green: 'img/green_line.png',
		blue: 'img/blue_line.png',
		orange: 'img/orange_line.png',
		redGreen: 'img/red_green_line.png',
		redOrange: 'img/red_orange_line.png',
		orangeBlue: '',
		blueGreen: 'img/green_blue_line.png',
		orangeGreen: 'img/orange_green_line.png'
	},
	lineColors: {
		red: "#ff0000",
		green: "#00ff00",
		blue: "#0000ff",
		orange: "#ff8800"
	},
	getLineColor: function(lineColor){
		switch(lineColor){
			case 'Green Line':
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
		//var hasRed = false,
		//	hasBlue = false,
		//	hasGreen = false,
		//	hasOrange = false;
		//$.each(icon.directions, function(i, dir){
		//	$.each(dir.substops, function(i, substop){
		//		switch(substop.line){
		//			case 'Green Line':
		//				hasGreen = true;
		//				break;
		//			case 'Orange Line':
		//				hasOrange = true;
		//				break;
		//			case 'Blue Line':
		//				hasBlue = true;
		//				break;
		//			case 'Red Line':
		//			case 'Mattapan Trolley':
		//				hasRed = true;
		//				break;
		//		}
		//	})
		//});
		var toReturn = {
			scaledSize: new google.maps.Size(24, 24),
			anchor: new google.maps.Point(12, 12),
			url: helpers.getLineIcon(icon.line)
		};

		//if (hasRed && hasGreen){
		//	toReturn.url = helpers.iconUrls.redGreen;
		//} else if (hasRed && hasOrange){
		//	toReturn.url = helpers.iconUrls.redOrange;
		//} else if (hasOrange && hasGreen){
		//	toReturn.url = helpers.iconUrls.orangeGreen;
		//} else if (hasGreen && hasBlue){
		//	toReturn.url = helpers.iconUrls.blueGreen;
		//} else if (hasRed){
		//	toReturn.url = helpers.iconUrls.red;
		//} else if (hasGreen){
		//	toReturn.url = helpers.iconUrls.green;
		//} else if (hasBlue){
		//	toReturn.url = helpers.iconUrls.blue;
		//} else if (hasOrange){
		//	toReturn.url = helpers.iconUrls.orange;
		//} else {
		//	console.log("Failed a line");
		//}

		return toReturn;
	},
	dateToTime: function(date){
		var hours = (date.getHours() - 1) % 12 + 1;
		var minutes = date.getMinutes().leftPad(2);
		var seconds = date.getSeconds().leftPad(2);
		var amPm = (date.getHours() >= 12) ? 'pm' : 'am';

		return hours + ':' + minutes + ':' + seconds + ' ' + amPm;
	},
	secondsToTimeString: function(time){
		var minutes = Math.floor(time/60);

		if (minutes > 0){
			return minutes + " mins away";
		} else {
			return "Arriving";
		}
	}
};

function Stop(lat, lng, name, directions){
	this.lat = lat;
	this.lng = lng;
	this.name = name;
	this.directions = directions || {};

	this.getIcon = function(){
		helpers.getIcon(this);
	}
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