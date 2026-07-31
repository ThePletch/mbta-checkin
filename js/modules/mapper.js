const Mapper = {
  map: null,
  defaultStops: [],
  defaultRouteIds: ["741", "742", "746", "749", "751", "Green-B", "Green-C", "Green-D", "Green-E", "Red", "Blue", "Orange"],
  defaultStopIds: [],
  center: {
    lat: 42.358,
    lng: -71.064
  },
  selected: null,
  pendingSelectionEvent: null,
  zoom: 14,
  featureManager: {
    _features: {},
    addFeature(key, feature) {
      Mapper.featureManager.destroyFeature(key);
      Mapper.featureManager._features[key] = feature;
      Mapper.featureManager.renderFeature(key);
    },
    // boilerplate getter to avoid needing to expose _features
    getFeature(key) {
      return Mapper.featureManager._features[key];
    },
    destroyFeature(key) {
      if (!Mapper.featureManager._features[key]) {
        return;
      }
      const feature = Mapper.featureManager._features[key];

      if (feature.constructor === Array) {
        for (const subfeature of feature) {
          subfeature.destroy();
        }
      } else {
        feature.destroy();
      }
    },
    renderFeature(key) {
      if (!Mapper.featureManager._features[key]) {
        return;
      }
      const feature = Mapper.featureManager._features[key];

      if (feature.constructor === Array) {
        for (const subfeature of feature) {
          subfeature.render();
        }
      } else {
        feature.render();
      }
    }
  },

  initialize() {
    Mapper.map = new google.maps.Map(document.getElementById('viewport'), {
      center: Mapper.center,
      zoom: Mapper.zoom,
      styles: jsonData.google_style,
      backgroundColor: '#2a2a2a',
      disableDefaultUI: true
    });

    Mapper.map.addListener('click', (clickData) => {
      Mapper.displayLocation({latitude: clickData.latLng.lat(), longitude: clickData.latLng.lng()});
    });

    Mapper.featureManager.addFeature('defaultRoutes', Mapper.defaultRouteIds.map((routeId) => {
      const route = jsonData.routes[routeId];
      return new Route(route.id, route.name, route.mode);
    }));

    Mapper.defaultStopIds = jsonData.default_stops;
    Mapper.featureManager.addFeature('defaultStops', Mapper.defaultStopIds.map((stopId) => {
      const stop = jsonData.stops[stopId];
      return new Stop(stop.id, stop.name, stop.lat, stop.lon, "Bus");
    }));

    Helpers.events.bind('modal-closed', Mapper.removeSelected);

    Helpers.events.bind('app-location-found', Mapper.displayLocation);

    Helpers.events.bind('stop-selected', Mapper.markStopSelected);

    Helpers.events.bind('stop-fetchdata-success', () => {
      Mapper.markSelectedStopState('success');
    });

    Helpers.events.bind('stop-fetchdata-error', () => {
      Mapper.markSelectedStopState('error');
      Mapper.pendingSelectionEvent = setTimeout(Mapper.removeSelected, 2000);
    });
  },

  async displayLocation(coords) {
    Mapper.featureManager.addFeature('userLocation', new LocationMarker(coords.latitude, coords.longitude));
    Mapper.zoomToLocation(coords);
    try {
      const stops = await Mbta.getNearbyStops(coords);
      Mapper.featureManager.addFeature('localStops', stops);
    } catch (err) {
      console.error(err);
    }
  },

  markSelectedStopState(state) {
    const currentIcon = Mapper.selected.getIcon();
    currentIcon.url = (() => {
      switch (state) {
        case 'error':
          return Helpers.iconUrls.selectedError;
        case 'success':
          return Helpers.iconUrls.selectedSuccess;
      }
    })();
    Mapper.selected.setIcon(currentIcon);
  },

  // TODO improve naming in marker manipulation methods
  markStopSelected(marker) {
    // delete any existing selection marker
    if (Mapper.selected != null) {
      Mapper.removeSelected();
    }

    Mapper.selected = new google.maps.Marker({
      position: new google.maps.LatLng(marker.lat, marker.lng),
      map: Mapper.map,
      icon: {
        url: Helpers.iconUrls.selected,
        scaledSize: new google.maps.Size(33, 33),
        anchor: new google.maps.Point(16, 16)
      }
    });
  },

  placeMarker(lat, lon, title, icon) {
    return new google.maps.Marker({
      position: new google.maps.LatLng(lat, lon),
      map: Mapper.map,
      title: title,
      icon: icon
    });
  },

  placeVehicleMarker(marker) {
    return Mapper.placeMarker(marker.lat, marker.lng, marker.destination,
      marker.icon || Helpers.getLiveIcon(marker));
  },

  // TODO deprecate
  placeStopMarker(marker) {
    const gMarker = Mapper.placeMarker(marker.lat, marker.lng, marker.name,
      marker.icon || Helpers.getIcon(marker));

    google.maps.event.addListener(gMarker, 'click', () => {
      Mapper.click.stopMarker(marker);
    });

    return gMarker;
  },

  // TODO deprecate
  placeStopMarkers(markers, extractor) {
    if (extractor == null) {
      extractor = (marker) => marker; // noop function
    }

    $.each(markers, (i, marker) => Mapper.placeStopMarker(extractor(marker)));
  },

  removeSelected() {
    if (Mapper.pendingSelectionEvent) {
      clearTimeout(Mapper.pendingSelectionEvent);
    }
    if (Mapper.selected) {
      Mapper.selected.setMap(null);
      Mapper.selected = null;
    }
  },

  zoomToLocation(location) {
    Mapper.map.setCenter(new google.maps.LatLng(location.latitude, location.longitude));
    Mapper.map.setZoom(16);
  }
};

window.Mapper = Mapper;
