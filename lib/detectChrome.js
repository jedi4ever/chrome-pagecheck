'use strict';
var fs = require('fs');

var detectChrome = function(options) {

  var locations = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/opt/google/chrome/chrome'
  ];

  if (options.location) {
    locations.unshift(options.location);
  }

  var chromeLocation;
  locations.every(function(location) {
    if (fs.existsSync(location)) {
      if (!chromeLocation) {
        chromeLocation = location ;
      }
    }
  });
  return chromeLocation;

};

module.exports = detectChrome;
