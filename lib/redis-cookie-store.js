'use strict';
var tough = require('tough-cookie');
var Store = tough.Store;
var permuteDomain = tough.permuteDomain;
var permutePath = tough.permutePath;
var util = require('util');
var async = require('async');
var _ = require('lodash');

function getKeyName(domain, path) {
  if (path) {
    return "cookie:" + domain + ":" + path;
  } else {
    return "cookie:" + domain;
  }
}

function RedisCookieStore(redisClient) {
  Store.call(this);
  this.idx = {};
  this.client = redisClient;
}
util.inherits(RedisCookieStore, Store);
RedisCookieStore.prototype.synchronous = true;

/*  // force a default depth:*/
//RedisCookieStore.prototype.inspect = function () {
  //return "";
/*};*/

RedisCookieStore.prototype.findCookie = function (domain, path, key, cb) {
  return this.client.hget(getKeyName(domain, path), key, cb);
};

RedisCookieStore.prototype.findCookies = function (domain, path, cb) {
  if (!domain) {
    return cb(null, []);
  }

  var domains = permuteDomain(domain) || [domain];
  var self = this;

  var pathMatcher;
  if (!path) {
    // null or '/' means "all paths"
    pathMatcher = function matchAll(domainKeys, cb) {
      async.map(
        domainKeys,
        self.client.hgetall,
        cb
      );
    };

  } else if (path === '/') {
    pathMatcher = function matchSlash(domainKeys, cb) {
      domainKeys.every(function (domainKey) {
        if (domainKey.match(/cookie:.*:\/$/gi)) {
          self.client.hgetall(domainKey, cb);
          return false;
        }
        return true;
      });
    };

  } else {
    var paths = permutePath(path) || [path];
    pathMatcher = function matchRFC(domainKeys, cb) {
      var domainPrefix = domainKeys[0].match(/(cookie:.*:)/i)[1]; //get domain key prefix e.g. "cookie:www.example.com"
      paths = _.map(function (path) { return domainPrefix + path; });
      var keys = _.intersection(domainKeys, paths);

      async.map(
        keys,
        self.client.hgetall,
        cb
      );
    };
  }

  async.map(
    domains,
    function (curDomain, mapCallback) {
      self.client.keys(getKeyName(domain) + ":*", function (err, domainKeys) {
        if (err) {
          return mapCallback(err);
        }
        if (!domainKeys || !domainKeys.length) {
          return mapCallback(null, null);
        }
        pathMatcher(domainKeys, mapCallback);
      });
    },
    function (err, results) {
      if (err) {
        return cb(err);
      }
      results = _.flatten(results);
      return cb(null, results);
    }
  );
};

RedisCookieStore.prototype.putCookie = function (cookie, cb) {
  this.client.hset(getKeyName(cookie.domain, cookie.path), cookie.key, cookie, cb);
};

RedisCookieStore.prototype.updateCookie = function updateCookie(oldCookie, newCookie, cb) {
  // updateCookie() may avoid updating cookies that are identical.  For example,
  // lastAccessed may not be important to some stores and an equality
  // comparison could exclude that field.
  this.putCookie(newCookie, cb);
};

RedisCookieStore.prototype.removeCookie = function removeCookie(domain, path, key, cb) {
  this.client.hdel(getKeyName(domain, path), key, cb);
};

RedisCookieStore.prototype.removeCookies = function removeCookies(domain, path, cb) {
  if (path) {
    return this.client.del(getKeyName(domain, path), cb);
  } else {
    this.client.keys(getKeyName(domain) + ":*", function (err, keys) {
      if (err) {
        return cb(err);
      }
      async.each(
        keys,
        this.client.del,
        cb
      );
    });
  }
};

module.exports = RedisCookieStore;
