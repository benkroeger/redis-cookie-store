'use strict';
var tough = require('tough-cookie');
var Store = tough.Store;
var permuteDomain = tough.permuteDomain;
var permutePath = tough.permutePath;
var util = require('util');
var async = require('async');
var _ = require('lodash');
var Cookie = tough.Cookie;

// putting id last to not break existing interface
function RedisCookieStore(redisClient, id) {
  Store.call(this);
  this.idx = {};
  this.id = id || 'default';
  this.client = redisClient;
  this.synchronous = false;
}
util.inherits(RedisCookieStore, Store);

RedisCookieStore.prototype.getKeyName = function getKeyName(domain, path) {
  if (path) {
    return "cookie-store:" + this.id + ":cookie:" + domain + ":" + path;
  } else {
    return "cookie-store:" + this.id + ":cookie:" + domain;
  }
};

RedisCookieStore.prototype.findCookie = function(domain, path, key, cb) {
  return this.client.hget(this.getKeyName(domain, path), key, cb);
};

RedisCookieStore.prototype.findCookies = function(domain, path, cb) {
  if (!domain) {
    return cb(null, []);
  }

  var domains = permuteDomain(domain) || [domain];
  var self = this;

  var paths = permutePath(path) || [path];
  var pathMatcher = function matchRFC(domainKeys, cb) {

    var domainPrefix = domainKeys[0].match(/(.*cookie:[^:]*:)/i)[1]; //get domain key prefix e.g. "cookie:www.example.com"
    var prefixedPaths = paths.map(function(path) {
      return domainPrefix + path;
    });
    // console.log(prefixedPaths);
    var keys = _.intersection(domainKeys, prefixedPaths).sort(function(a, b) {
      return a.length - b.length;
    });

    async.parallel(keys.map(function(key) {
      return function(callback) {
        self.client.hgetall(key, function(err, hash) {
          callback(err, hash);
        });
      };
    }), function(err, results) {
      if (err) {
        return cb(err);
      }
      cb(null, _.merge.apply(_, results));
    });
  };


  async.parallel(domains.sort(function(a, b) {
    return a.length - b.length;
  }).map(function(domain) {
    return function(callback) {
      self.client.keys(self.getKeyName(domain) + ":*", function(err, domainKeys) {
        if (err) {
          return callback(err, null);
        }
        if (!domainKeys || !domainKeys.length) {
          return callback(null, {});
        }
        pathMatcher(domainKeys, callback);
      });
    };
  }), function(err, results) {
    if (err) {
      return cb(err);
    }
    cb(err, _.values(_.merge.apply(_, results)).map(function(cookieString) {
      var cookie = Cookie.parse(cookieString);
      if (!cookie.domain) {
        cookie.domain = domain;
      }
      return cookie;
    }));
  });
};

RedisCookieStore.prototype.putCookie = function(cookie, cb) {
  this.client.hset(this.getKeyName(cookie.domain, cookie.path), cookie.key, cookie.toString(), cb);
};

RedisCookieStore.prototype.updateCookie = function updateCookie(oldCookie, newCookie, cb) {
  // updateCookie() may avoid updating cookies that are identical.  For example,
  // lastAccessed may not be important to some stores and an equality
  // comparison could exclude that field.
  this.putCookie(newCookie, cb);
};

RedisCookieStore.prototype.removeCookie = function removeCookie(domain, path, key, cb) {
  this.client.hdel(this.getKeyName(domain, path), key, cb);
};

RedisCookieStore.prototype.removeCookies = function removeCookies(domain, path, cb) {
  if (path) {
    return this.client.del(this.getKeyName(domain, path), cb);
  } else {
    this.client.keys(this.getKeyName(domain) + ":*", function(err, keys) {
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
