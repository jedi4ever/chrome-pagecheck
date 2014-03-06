'use strict';

var Websocket = require('ws');
var request = require('request');
var fs = require('fs');
var debug = require('debug')('chrome-pagecheck');
var async = require('async');
/* jshint ignore:start */
var colors = require('colors');
/* jshint ignore:end */
var Url = require('url');

function run(options, callback) {
  var idCount = 0;
  var snapNow = 0;
  var snapCheck;
  var errors = [];
  var mainRequest = null;

  var settings = {
    console: true,
    page: false,
    data: false
  };

  var jsonUrl = [
    'http://',
    options.host,
    ':',
    options.port,
    '/json'
  ].join('');

  var imageLength = 0;
  var imageprevLength = 0;


  // Get the URL
  var getDebugUrl = function(jsonUrl, callback) {

    var data_options = {
      url: jsonUrl
    };

    request.get(data_options, function(err, response, body) {

      if (err) {
        return callback(err);
      }

      var data = JSON.parse(body);
      var debugUrl;

      data.forEach(function(tab) {
        debug(JSON.stringify(tab));
        // Sometime we have other tabs like background pages
        if (tab.type === 'page') {
          debugUrl = tab.webSocketDebuggerUrl;
        }
      });

      if (debugUrl) {
        console.log('found a debugURL through request', debugUrl);
        return callback(null, debugUrl);
      } else {
        return callback(new Error('could not find a debugURL yet'));
      }

    });
  };

  var tryGetDebugUrl = function(jsonUrl, callback) {
    var count = 0;
    var debugCheck = setInterval(function() {

      getDebugUrl(jsonUrl, function(err, debugUrl) {
        if (!err) {
          clearInterval(debugCheck);
          return callback(null, debugUrl);
        } else {
          console.log('Error getting the debug URL - retrying', err);
          count++;
          if (count > 4) {
            clearInterval(debugCheck);
            return callback(new Error(' can\'t get the debugURL'));
          }
        }
      });
    },1000);
  };

  var waitForWs = function(debugUrl, callback) {
    var count = 0;

    var interval = setInterval(function() {
      wsCheck(debugUrl,function(err, debugUrl) {
        if (debugUrl) {
          clearInterval(interval);
          return callback(null, debugUrl);
        } else {
          count++;
          if (count > 100) {
            clearImmediate(interval);
            return callback(new Error('can not get debug URL in time'));
          } else {
          }
        }
      });
    },1000);

  };

  var wsCheck = function(debugUrl,callback) {
    var ws = new Websocket(debugUrl);

    ws.on('error', function(err) {
      debug(err);
      ws.close();
      ws.removeAllListeners('error');
      ws.removeAllListeners('open');
      return callback(new Error('Can\'t connect to WS URL' + debugUrl));
    });

    ws.on('open', function(){
      // Debugger can only have 1 connnection!
      ws.close();
      ws.removeAllListeners('error');
      ws.removeAllListeners('open');
      return callback(null, debugUrl);
    });
  };

  // Go through sequence
  async.waterfall([
    function(callback) {
    tryGetDebugUrl(jsonUrl, callback);
  },
  function(debugUrl, callback) {
    waitForWs(debugUrl, callback);
  },
  function(url, callback) {

  var screenCheck = setInterval(function() {
    //console.log(imageLength , imageprevLength);
    if (imageLength === imageprevLength) {
      console.log('Screen has not changed for 2 seconds');
      clearInterval(screenCheck);
      clearInterval(snapCheck);
      if (mainRequest !== 'ok') {
        console.log('Received no response on our main request'.red);
        errors.push('Received no response on our main request');
      }
      return callback(null, errors );
    } else {
      imageprevLength = imageLength;
    }
  },3 * 1000);

    console.log('Connecting to remote Chrome session on',url);
    listen(url,callback);
  }
  ], function(err, results) {
    if (err) {
      console.log('something went wrong along the way',err);
    }
    callback(err,results);
  });


  function sendCommand(ws, method,params) {
    idCount++;

    var packet = {
      id: idCount,
      method: method,
    };

    if (params !== undefined) {
      packet.params = params;
    }

    ws.send(JSON.stringify(packet));
    return idCount;
  }

  var url = options.url;
  console.log('visiting', url);

  function listen(debugUrl) {
    var counter = 0;
    var ws = new Websocket(debugUrl);

    ws.on('error', function(err) {
      console.log('erorr listening for the debugURL' ,err);
    });

    ws.on('open', function() {

      sendCommand(ws, 'Page.navigate', { url: 'about:blank' });
      //sendCommand(ws, 'Page.setDeviceMetricsOverride', { width: 1800, height: 1200, deviceScaleFactor: 2, emulateViewport: true, fitWindow: false });
      sendCommand(ws, 'Network.clearBrowserCache');
      sendCommand(ws, 'Page.enable');
      sendCommand(ws, 'Network.enable');
      //sendCommand(ws, 'Network.setUserAgentOverride', { userAgent: 'lalalal'});
      sendCommand(ws, 'Console.enable');
      //sendCommand(ws, 'Timeline.start');
      sendCommand(ws, 'Debugger.enable');
      sendCommand(ws, 'Network.setCacheDisabled', { cacheDisabled: true});
      setTimeout(function() {
        sendCommand(ws, 'Page.navigate', { url: url });
      }, 1000);

      function snap() {
        sendCommand(ws, 'Page.captureScreenshot');
      }

      if (snapNow > 1) {
        snap();
      }
      snapCheck = setInterval(function() {
        if (snapNow > 1) {
          snap();
        }
      },200);

    });

    function processNetwork(reply) {
      var params;

      // {"method":"Network.responseReceived","params":{"requestId":"82216.2","frameId":"82216.1","loaderId":"82216.3","timestamp":1394028301.378946,"type":"Document","response":{"url":"data:text/html,chromewebdata","status":0,
      if (reply.method === 'Network.requestWillBeSent') {
        params = reply.params;
        if (params) {
          var request = params.request;
          if (request) {
            if (Url.parse(request.url).href === Url.parse(options.url).href) {
              mainRequest = params.requestId;
              console.log('tracing URL request', mainRequest, options.url);
            }
          }
        }
      }

      if (reply.method === 'Network.responseReceived') {
        params = reply.params;
        if (params) {
          var response = params.response;
          if (response) {
            if (params.requestId === mainRequest) {
              mainRequest = 'ok';
              debug('Got reply on mainrequest' + JSON.stringify(params));
            }
          }
        }
      }

      var el = [
        'Network.requestWillBeSent',
        'Network.responseReceived',
        'Network.dataReceived',
        'Network.webSocketFrameSent',
        'Network.webSocketClosed',
        'Network.dataReceived',
        'Network.loadingFinished',
        'Network.requestServedFromCache',
        'Network.webSocketHandshakeResponseReceived',
        'Network.webSocketWillSendHandshakeRequest',
        'Network.webSocketFrameReceived',
        'Network.webSocketCreated'
      ];

      if (el.indexOf(reply.method) < 0) {
        var msg = reply.params.message;
        console.log(msg,reply);
      }
    }

    function processPage(reply) {
      if (reply.method === 'Page.frameStartedLoading') {
        snapNow++;
      }
      if (settings.page) {
        console.log(reply);
      }
    }

    function processTimeline(reply) {

      var el = [
        //'Timeline.eventRecorded'
      ];
      if (reply.method === 'Timeline.eventRecorded') {
        if (settings.timeline) {
          console.log(reply.params.record);
        }
      }

      if (el.indexOf(reply.method) <  0) {
        var msg = reply.params.message;
        console.log(msg,reply);
      }
    }


    function processDebugger(reply) {

      var el = [
        'Debugger.globalObjectCleared',
        'Debugger.scriptParsed'
      ];

      if (el.indexOf(reply.method) < 0) {
        var msg = reply.params.message;
        console.log(msg,reply);
      }
    }

    function processConsole(reply) {
      if (reply.method === 'Console.messageAdded') {
        var msg = reply.params.message;

        //console.log(msg.level, msg.text.green);
        if (msg.level === 'warning') {
          //if (settings.console) {
          console.log(msg.text.yellow);
          //}
        } else if (msg.level === 'error') {
          //if (settings.console) {
          if (msg.source === 'rendering') {
            console.log(msg.text.yellow);
          } else {
            errors.push(msg.text);
            console.log(msg.text.red);
          }
          //}
        } else {
          console.log(msg.text.grey);
        }
      }
      //
      //case 'Console.messagesCleared': 
    }

    function processData(reply) {
      var id = reply.id;
      var result = reply.result;
      var data = result.data;
      //console.log(Object.keys(reply.result));

      if (result) {
        var base64 = result.data;
        if (base64) {
          if (base64 !== preImage) {
            counter++;
            if (data) {
              if (settings.data) {
                console.log(base64.length);
              }
            }
            imageLength = base64.length;
            preImage = base64;
            var b = new Buffer(base64, 'base64');
            fs.writeFileSync('image-'+id+'.png', b);
          }

        } else {
          console.log(data);
        }
      }
    }

    var preImage = '';
    ws.on('message', function(data) {

      var reply = JSON.parse(data);
      var method = reply.method;
      var domain = 'unknown';
      if (method !== undefined) {
        domain = method.split('.')[0];
      }

      if (reply.error) {
        errors.push(reply.error.message);
        console.error(reply.error.message.red);
        return;
      }

      if (reply.result && reply.result.data !== undefined) {
        domain = 'Data';
      }

      switch (domain) {
        case 'Page':
          debug(JSON.stringify(reply));
          processPage(reply);
        break;
        case 'Console':
          debug(JSON.stringify(reply));
          processConsole(reply);
        break;
        case 'Network':
          debug(JSON.stringify(reply));
          processNetwork(reply);
        break;
        case 'Timeline':
          debug(JSON.stringify(reply));
          processTimeline(reply);
        break;
        case 'Debugger':
          debug(JSON.stringify(reply));
          processDebugger(reply);
        break;
        case 'Data':
          processData(reply);
        break;
        default:
          debug(JSON.stringify(reply));
          ////console.log(reply);
      }


    });

  }
}

module.exports = {
  run: run
};
