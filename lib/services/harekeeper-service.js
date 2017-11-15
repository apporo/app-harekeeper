'use strict';

var events = require('events');
var util = require('util');
var path = require('path');
var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('debug')('appHomepage:service');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  var contextPath = pluginCfg.contextPath || '/harekeeper';

  var express = params.webweaverService.express;
  var router = express.Router();

  router.route('/').get(function(req, res, next) {
    debugx.enabled && debugx(' - GET [%s]', req.url);
    res.json({});
  });

  self.getRestRouterLayer = function() {
    return {
      name: 'app-harekeeper-rest',
      path: contextPath,
      middleware: router
    }
  }

  params.webweaverService.push([
    params.webweaverService.getDefaultRedirectLayer(),
    self.getRestRouterLayer()
  ], pluginCfg.priority);

  debugx.enabled && debugx(' - constructor end!');
};

Service.referenceList = [ "webweaverService", "harekeeperTrigger" ];

module.exports = Service;
