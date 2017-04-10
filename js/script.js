'use strict';

/*************************************************/
/********************* DATA **********************/
/*************************************************/
var debugging = false;

var map;
var geocoder;
var infoWindow;
var bounds;
var path;
var pathSymbol;
var autocomplete;
var selectedMarker;

/** All map's active markers */
var markers = [];

/** Selected markers structures */
var startingPoint = {
    markerType: 'startingPoint',
    markerIndex: -1,
    lat: -1,
    lng: -1,
    icon: 'https://maps.google.com/mapfiles/kml/paddle/1.png'
};

var destinationPoint = {
    markerType: 'destinationPoint',
    markerIndex: -1,
    lat: -1,
    lng: -1,
    icon: 'https://maps.google.com/mapfiles/kml/paddle/2.png'
};

var distance;
var centerLat;
var centerLng;
var animateInterval;
var calcBtnSelected = false;

/** HTML elements */
var addressH5;
var calcBtn;
var closeGuideBtn;
var deleteBtn;
var deleteAllBtn;
var deselectBtn;
var destinationBtn;
var markerInfoDiv;
var fitMapBtn;
var guideDiv;
var guideIcon;
var locationInput;
var mapDiv;
var startBtn;
var topPanelDiv;

/*******************************************************/
/********************** FUNCTIONS **********************/
/*******************************************************/

function initMap() {
    var mapReady = false;

    /** Get HTML elements */
    $('[data-toggle="tooltip"]').tooltip();
    addressH5 = $('#address');
    calcBtn = $('#btn-calc');
    closeGuideBtn = $('#btn-close-guide');
    deleteAllBtn = $('#btn-delete-all');
    deleteBtn = $('#btn-delete');
    deselectBtn = $('#btn-deselect');
    destinationBtn = $('#btn-destination');
    markerInfoDiv = $('#marker-info');
    fitMapBtn = $('#btn-fit-map');
    guideDiv = $('#guide-carousel');
    guideIcon = $('#guide-icon');
    locationInput = $('#input-location');
    mapDiv = $('#map');
    startBtn = $('#btn-start');
    topPanelDiv = $('#top-panel');

    /** Show guide if user is first time on website */
    if (localStorage.getItem('guide') == null) {
        showGuide();
    }

    /** Initiate Google Maps elements */
    map = new google.maps.Map(mapDiv[0], {
        fullscreenControl: false,
        draggableCursor: 'auto',
        zoom: 14,
        center: {lat: 50.06465, lng: 19.94498},
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DEFAULT,
            position: google.maps.ControlPosition.LEFT_BOTTOM
        }
    });

    autocomplete = new google.maps.places.Autocomplete(locationInput[0]);
    autocomplete.bindTo('bounds', map);
    
    geocoder = new google.maps.Geocoder();

    infoWindow = new google.maps.InfoWindow();

    pathSymbol = {
        path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
        scale: 5,
        strokeColor: '#ff4845'
    };

    path = new google.maps.Polyline({
        geodesic: true,
        strokeColor: '#ff4845',
        strokeOpacity: 1.0,
        strokeWeight: 6,
        icons: [{
            icon: pathSymbol,
            offset: '100%'
        }]
    });

    /** Assign event handlers */
    calcBtn.click(function () {
        calcBtnSelected = true;
        prettyDistance();
    });

    closeGuideBtn.click(function () {
        if (localStorage.getItem('guide') == null) {
            localStorage.setItem('guide', 'false');
        }
        hideGuide();
    });

    deleteBtn.click(function () {
        deleteMarker(selectedMarker);
    });


    deleteAllBtn.click(function () {
        for (var i = markers.length - 1; i >= 0; i--)
            deleteMarker(markers[i]);
    });

    deselectBtn.click(function () {
        deselectMarker(selectedMarker);
        selectedMarker.setIcon(null);
    });

    destinationBtn.click(function () {
        setMarkerAnimation(destinationPoint, startingPoint);
        setMarkerStruct(selectedMarker, destinationPoint, startingPoint);
        clearInterval(animateInterval);
        drawPathAndCenterMap(startingPoint, destinationPoint);
    });

    fitMapBtn.click(function () {
        if (markers.length > 0) {
            var bounds = new google.maps.LatLngBounds();

            // Create bounds from markers
            for (var i = 0; i < markers.length; i++) {
                bounds.extend(markers[i].getPosition());
            }

            // Don't zoom in too far on only one marker
            if (markers.length === 1) {
                var extendPoint1 = new google.maps.LatLng(bounds.getNorthEast().lat() + 0.01, bounds.getNorthEast().lng() + 0.01);
                var extendPoint2 = new google.maps.LatLng(bounds.getNorthEast().lat() - 0.01, bounds.getNorthEast().lng() - 0.01);
                bounds.extend(extendPoint1);
                bounds.extend(extendPoint2);
            }

            map.fitBounds(bounds);
            map.setCenter(bounds.getCenter());
        }
    });

    guideIcon.click(function () {
        showGuide();
    });

    startBtn.click(function () {
        setMarkerAnimation(startingPoint, destinationPoint);
        setMarkerStruct(selectedMarker, startingPoint, destinationPoint);
        clearInterval(animateInterval);
        drawPathAndCenterMap(startingPoint, destinationPoint);
    });

    /** Assign Google Map elements listeners */
    map.addListener('click', function (e) {
        placeMarkerAndPanTo(e.latLng, map);
    });

    map.addListener('idle', function () {
        map.panBy(0, 0);
        if (!mapReady) {
            map.controls[google.maps.ControlPosition.TOP_CENTER].push(topPanelDiv[0]);
            topPanelDiv.fadeIn('fast');
            topPanelDiv.css('display', 'flex');
            guideIcon.fadeIn('fast');
            mapReady = true;
        }
    });

    path.addListener('click', function () {
        if (calcBtnSelected) {
            prettyDistance();
            infoWindow.setPosition(new google.maps.LatLng(centerLat, centerLng));
            infoWindow.open(map);
        }
        else {
            infoWindow.open(map);
        }
    });

    autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();

        if (!place.geometry)
            return;

        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }

        placeMarkerAndPanTo(place.geometry.location, map);
    });
}

function showGuide() {
    guideDiv.fadeIn('slow');
    mapDiv.fadeTo("slow", 0.4);
    guideIcon.fadeOut('slow');
    mapDiv.css('pointer-events', 'none');
}

function hideGuide() {
    guideDiv.fadeOut('slow');
    mapDiv.fadeTo("slow", 1);
    guideIcon.fadeIn('slow');
    mapDiv.css('pointer-events', 'auto');
}

/** Distinct distance less than 1 km and above 1 km */
function prettyDistance() {
    if (!distance)
        return;

    if (distance > 1000) {
        distance /= 1000;
        distance = distance.toFixed(3);
        infoWindow.setContent('Distance: ' + distance.toString() + ' km');
    }
    else
        infoWindow.setContent('Distance: ' + distance.toString() + ' m');
}

function placeMarkerAndPanTo(latLng, map) {
    var marker = new google.maps.Marker({
        position: latLng,
        animation: google.maps.Animation.DROP,
        draggable: true,
        title: 'Show marker info',
        map: map
    });

    getAddress(marker, addMarker);
    map.panTo(latLng);
}

function getAddress(marker, addMarkerClb) {
    geocoder.geocode({'location': marker.position}, function (results, status) {
        if (status === 'OK') {
            if (results[0]) {
                marker.address = prettyAddress(results[0].formatted_address);
                addMarkerClb(marker, addMarkerListeners);
            }
        }
    });
}

function addMarker(marker, addMarkerListenersClb) {
    markers.push(marker);
    addMarkerListenersClb(marker);
}

function addMarkerListeners(marker) {
    selectedMarker = marker;
    showMarkerInfo(marker);

    marker.addListener('click', function () {
        selectedMarker = this;
        showMarkerInfo(marker);
    });

    marker.addListener('rightclick', function () {
        deleteMarker(this);
    });

    marker.addListener('dragend', function (e) {
        placeMarkerAndPanTo(e.latLng, map);
        deleteMarker(this);
    });
}

function setMarkerStruct(marker, selectedMarkerStruct, linkedMarkerStruct) {
    selectedMarkerStruct.markerIndex = markers.indexOf(marker);
    selectedMarkerStruct.lat = markers[selectedMarkerStruct.markerIndex].position.lat();
    selectedMarkerStruct.lng = markers[selectedMarkerStruct.markerIndex].position.lng();

    if (selectedMarkerStruct.markerIndex === linkedMarkerStruct.markerIndex) {
        clearMarkerStruct(linkedMarkerStruct);
    }
    markers[selectedMarkerStruct.markerIndex].setIcon(selectedMarkerStruct.icon);
}

function setMarkerAnimation(selectedMarkerStruct, linkedMarkerStruct) {
    if (selectedMarkerStruct.markerIndex != -1) {
        markers[selectedMarkerStruct.markerIndex].setIcon(null);
        markers[selectedMarkerStruct.markerIndex].setAnimation(google.maps.Animation.DROP);
        if (linkedMarkerStruct.markerIndex != -1)
            markers[linkedMarkerStruct.markerIndex].setAnimation(google.maps.Animation.DROP);
    }
}

function showMarkerInfo(marker) {
    addressH5.html(marker.address);
    infoWindow.setContent(markerInfoDiv[0]);
    markerInfoDiv.fadeIn('slow');
    infoWindow.open(map, marker);
}

/** Draw path and center the map when startingPoint and destinationPoint markers are selected */
function drawPathAndCenterMap(startingPoint, destinationPoint) {
    if (startingPoint.markerIndex != -1 && destinationPoint.markerIndex != -1) {
        markers[startingPoint.markerIndex].setAnimation(google.maps.Animation.BOUNCE);
        markers[destinationPoint.markerIndex].setAnimation(google.maps.Animation.BOUNCE);

        bounds = new google.maps.LatLngBounds();
        var startingPointLatLng = new google.maps.LatLng(startingPoint.lat, startingPoint.lng);
        var destinationPointLatLng = new google.maps.LatLng(destinationPoint.lat, destinationPoint.lng);

        centerLat = (startingPoint.lat + destinationPoint.lat) / 2.0;
        centerLng = (startingPoint.lng + destinationPoint.lng) / 2.0;

        bounds.extend(startingPointLatLng);
        bounds.extend(destinationPointLatLng);
        map.fitBounds(bounds);

        if (calcBtnSelected === false) {
            distance = (google.maps.geometry.spherical.computeDistanceBetween(startingPointLatLng, destinationPointLatLng)).toFixed(2);
            infoWindow.setContent(calcBtn[0]);
            calcBtn.css('display', 'block');
        }
        else
            prettyDistance();

        path.setPath([startingPointLatLng, destinationPointLatLng]);
        path.setMap(map);
        animateArrow(path);

        infoWindow.setPosition(new google.maps.LatLng(centerLat, centerLng));
        infoWindow.open(map);
    } else {
        calcBtnSelected = false;
        path.setMap(null);
    }
}

function prettyAddress(formatted_address) {
    var parts = formatted_address.split(', ');
    var prettyAddress = '';

    /** Control info window width */
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].length > 23) {
            var words = parts[i].split(' ');
            if (words.length > 3) {
                var center = Math.floor((words.length - 1) / 2);
                words[center] = words[center].concat('<br>');
                parts[i] = words.join(' ').trim();
            }
            else {
                parts[i].replace(' ', '<br>')
            }
        }
        if (i < parts.length - 1)
            parts[i] = parts[i].concat(',<br>');

        prettyAddress = prettyAddress.concat(parts[i]);
    }

    return prettyAddress;
}

function deleteMarker(marker) {
    marker.setMap(null);
    deselectMarker(marker);

    if (markers.indexOf(marker) < startingPoint.markerIndex)
        startingPoint.markerIndex -= 1;

    if (markers.indexOf(marker) < destinationPoint.markerIndex)
        destinationPoint.markerIndex -= 1;

    markers.splice(markers.indexOf(marker), 1);
}

function deselectMarker(marker) {
    switch (markers.indexOf(marker)) {
        case startingPoint.markerIndex:
            if (markers[destinationPoint.markerIndex]) {
                markers[startingPoint.markerIndex].setAnimation(google.maps.Animation.DROP);
                markers[destinationPoint.markerIndex].setAnimation(google.maps.Animation.DROP);
            }
            clearMarkerStruct(startingPoint);
            clearInterval(animateInterval);
            infoWindow.close();
            path.setMap(null);
            distance = null;
            calcBtnSelected = false;
            break;
        case destinationPoint.markerIndex:
            if (markers[startingPoint.markerIndex]) {
                markers[startingPoint.markerIndex].setAnimation(google.maps.Animation.DROP);
                markers[destinationPoint.markerIndex].setAnimation(google.maps.Animation.DROP);
            }
            clearMarkerStruct(destinationPoint);
            clearInterval(animateInterval);
            infoWindow.close();
            path.setMap(null);
            distance = null;
            calcBtnSelected = false;
            break;
    }
}

function clearMarkerStruct(selectedMarkerStruct) {
    selectedMarkerStruct.markerIndex = -1;
    selectedMarkerStruct.lat = -1;
    selectedMarkerStruct.lng = -1;
}

function animateArrow(line) {
    var count = 0;
    var speed = 4;
    var intervalMs = 16;

    animateInterval = window.setInterval(function () {
        count = (count + 1) % (speed * 100);
        var icons = line.get('icons');
        icons[0].offset = (count / speed ) + '%';
        line.set('icons', icons);
    }, intervalMs);
}

function debug(msg) {
    if (debugging) {
        console.log('[DEBUG]');
        console.log(msg);
    }
}