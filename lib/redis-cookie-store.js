'use strict';

// node core modules
const util = require('util');

// 3rd party modules
const async = require('async');
const _ = require('lodash');
const {
  Store, permuteDomain, permutePath, Cookie,
} = require('tough-cookie');

// internal modules

// putting id last to not break existing interface
function RedisCookieStore(redisClient, id) {
  const self = this;

  Store.call(self);
  self.idx = {};
  self.id = id || 'default';
  self.client = redisClient;
  self.synchronous = false;
}
util.inherits(RedisCookieStore, Store);

RedisCookieStore.prototype.getKeyName = function getKeyName(domain, path) {
  const self = this;

  if (path) {
    return `cookie-store:${self.id}:cookie:${domain}:${path}`;
  }
  return `cookie-store:${self.id}:cookie:${domain}`;
};

RedisCookieStore.prototype.findCookie = function findCookie(domain, path, cookieName, cb) {
  const self = this;
  const { client } = self;

  const keyName = self.getKeyName(domain, path);
  client.hget(keyName, cookieName, cb);
};

const cookiePrefixRegexp = /(.*cookie:[^:]*:)/i;
const pathMatcher = ({ domainKeys, paths, client }, cb) => {
  const [firstDomainKey] = domainKeys;
  const [, domainPrefix] = firstDomainKey.match(cookiePrefixRegexp); // get domain key prefix e.g. "cookie:www.example.com"
  const prefixedPaths = paths.map(path => domainPrefix + path);
  const keys = _.intersection(domainKeys, prefixedPaths).sort((a, b) => a.length - b.length);

  const jobs = keys.map(key => next => client.hgetall(key, next));

  async.parallel(jobs, (err, results) => {
    if (err) {
      cb(err);
      return;
    }
    cb(null, _.merge(...results));
  });
};

RedisCookieStore.prototype.findCookies = function findCookies(domain, path, cb) {
  const self = this;
  const { client } = self;

  if (!domain) {
    cb(null, []);
    return;
  }

  const permutedDomains = permuteDomain(domain) || [domain];
  // sort permuted domains (length ascending)
  const sortedPermutedDomains = permutedDomains.sort((a, b) => a.length - b.length);

  const paths = permutePath(path) || [path];

  // prepare jobs to load cookie data from redis for each permuted domain
  const jobs = sortedPermutedDomains.map(permutedDomain => (next) => {
    const keyName = `${self.getKeyName(permutedDomain)}:*`;

    client.keys(keyName, (err, domainKeys) => {
      if (err) {
        next(err, null);
        return;
      }
      if (!domainKeys || !domainKeys.length) {
        next(null, {});
        return;
      }

      pathMatcher({ domainKeys, paths, client }, next);
    });
  });

  async.parallel(jobs, (err, results) => {
    if (err) {
      cb(err);
      return;
    }
    cb(
      err,
      _.values(_.merge(...results)).map((cookieString) => {
        const cookie = Cookie.parse(cookieString);

        if (!cookie.domain) {
          cookie.domain = domain;
        }

        return cookie;
      })
    );
  });
};

RedisCookieStore.prototype.putCookie = function putCookie(cookie, cb) {
  const self = this;
  const { client } = self;

  const { key: cookieName, domain, path } = cookie;
  const keyName = self.getKeyName(domain, path);
  const cookieString = cookie.toString();

  client.hset(keyName, cookieName, cookieString, cb);
};

RedisCookieStore.prototype.updateCookie = function updateCookie(oldCookie, newCookie, cb) {
  const self = this;

  // updateCookie() may avoid updating cookies that are identical.  For example,
  // lastAccessed may not be important to some stores and an equality
  // comparison could exclude that field.
  self.putCookie(newCookie, cb);
};

RedisCookieStore.prototype.removeCookie = function removeCookie(domain, path, cookieName, cb) {
  const self = this;
  const { client } = self;

  const keyName = self.getKeyName(domain, path);
  client.hdel(keyName, cookieName, cb);
};

RedisCookieStore.prototype.removeCookies = function removeCookies(domain, path, cb) {
  const self = this;
  const { client } = self;

  if (path) {
    const keyName = self.getKeyName(domain, path);
    client.del(keyName, cb);
    return;
  }

  const keyName = `${self.getKeyName(domain)}:*`;
  client.keys(keyName, (err, keys) => {
    if (err) {
      cb(err);
      return;
    }

    async.each(keys, client.del.bind(client), cb);
  });
};

module.exports = RedisCookieStore;
