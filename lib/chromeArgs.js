'use strict';

var debug = require('debug')('chrome-pagecheck');

var chromeArgs = function(options) {
  var port = options.port;

  //check for Tmux
  // brew install reattach-to-user-namespace
  var cliArgs = [
    '--remote-debugging-port='+port,
    '--user-data-dir=/tmp/bla4',
    '--disable-metrics'
  ];

  var detectChrome = require('./detectChrome');
  var chromeLocation = detectChrome(options);

  if (chromeLocation) {
    cliArgs.unshift(chromeLocation);
  } else {
    console.log('Could not find a Chrome executable');
    process.exit(-1);
  }

  if (process.env.TMUX) {
    debug('running inside tmux');
    cliArgs.unshift('reattach-to-user-namespace');
  }
  return cliArgs;

};

module.exports = chromeArgs;
