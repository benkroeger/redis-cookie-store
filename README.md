# Redis Cookie Store

redis-cookie-store is a Redis store for tough-cookie module. See
[tough-cookie documentation](https://github.com/goinstant/tough-cookie#constructionstore--new-memorycookiestore-rejectpublicsuffixes) for more info.

## Installation

         $ npm install redis-cookie-store

## Options

  `client` An existing redis client object you normally get from `redis.createClient()`
  `id` defining an ID for each redis store so that we can use multiple stores with the same redis database

## Usage

      var redis = require("redis");
      var client = redis.createClient();
      var CookieJar = require("tough-cookie").CookieJar;
      var RedisCookieStore = require("redis-cookie-store");

      var jar = new CookieJar(new RedisCookieStore(client), 'my-cookie-store');

# License 
  
  MIT
