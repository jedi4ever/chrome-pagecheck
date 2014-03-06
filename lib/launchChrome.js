'use strict';

var debug = require('debug')('chrome-pagecheck:process');
var spawn = require('child_process').spawn;
var chromeArgs = require('./chromeArgs');

function launchChrome(options) {
  var cliArgs = chromeArgs(options);

  debug(JSON.stringify(cliArgs));
  var chromeProc = spawn(cliArgs[0], cliArgs.slice(1));

  chromeProc.stdout.on('data', function (data) {
    debug(data);
  });

  return chromeProc;

}

module.exports = launchChrome;
