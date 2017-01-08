/* Code adapted from: https://devcenter.heroku.com/articles/node-sessions#the-middleware-stack */
var expressSession = require('express-session');
var RedisStore = require('connect-redis')(expressSession);

module.exports = function(auth) {
    const ONE_HOUR = 3600000;
    var store = new RedisStore({ url: auth.redisURL });
    var session = expressSession({
        secret: auth.sessionSecret,
        store: store,
        resave: true,
        saveUninitialized: true,
        cookie: { secure: auth.useSecure, maxAge: ONE_HOUR/2 }
    });
    return session;
};