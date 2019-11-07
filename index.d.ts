declare module "redis-cookie-store" {
  export default redis_cookie_store;
}

declare type Cookie = import('tough-cookie').Cookie;

declare class redis_cookie_store {
  constructor(redisClient: any, id: string);

  findCookie(domain: string, path: string, cookieName: string, cb: (err: Error | null, cookie: Cookie | null) => void): void;

  findCookies(domain: string, path: string, cb: (err: Error | null, cookie: Cookie[]) => void): void;

  getKeyName(domain: string, path: string): string;

  putCookie(cookie: Cookie, cb: (err: Error | null) => void): void;

  removeCookie(domain: string, path: string, cookieName: string, cb: (err: Error | null) => void): void;

  removeCookies(domain: string, path: string, cb: (err: Error | null) => void): void;

  updateCookie(oldCookie: Cookie, newCookie: Cookie, cb: (err: Error | null) => void): void;

  getAllCookies(cb: (err: Error | null, cookie: Cookie[]) => void): void;
}
