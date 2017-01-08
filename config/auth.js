const url = require('url');

function isset(a) {
    return typeof a !== "undefined";
}

// Make sure proper variables have been set.
if (!isset(process.env.SESSION_SECRET) ||
        !isset(process.env.SECRET_KEY) ||
        !isset(process.env.GOOGLE_CLIENT_ID) ||
        !isset(process.env.GOOGLE_CLIENT_SECRET) ||
        !isset(process.env.GOOGLE_CALLBACK_URL) ||
        !isset(process.env.MONGO_DB_URL) ||
        !isset(process.env.REDISCLOUD_URL) ||
        !isset(process.env.USE_SECURE_COOKIES)) {
    console.error("Error: Please set the proper authentication config variables in heroku.");
    process.exit(1);
}

// Create authentication object with all necessary info.
const auth = {
    sessionSecret: process.env.SESSION_SECRET,
    useSecureCookies: process.env.USE_SECURE_COOKIES == true,
    secretKey: process.env.SECRET_KEY,
    google: {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    mongoDB: {
        URL: process.env.MONGO_DB_URL
    },
    redis: {}
};

// Parse redis data from Url
// Code adapted from: http://stackoverflow.com/a/17246578/3673087
var redisUrl = url.parse(process.env.REDISCLOUD_URL);
auth.redis.protocol = redisUrl.protocol.substr(0, 
                        redisUrl.protocol.length - 1); // Remove trailing ':'
auth.redis.username = redisUrl.auth.split(':')[0];
auth.redis.password = redisUrl.auth.split(':')[1];
auth.redis.host = redisUrl.hostname;
auth.redis.port = redisUrl.port;
auth.redis.database = redisUrl.path == null ? 0 : 
    parseInt(redisUrl.path.substring(1));

module.exports = auth;