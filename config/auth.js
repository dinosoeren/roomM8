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
        !isset(process.env.USE_SECURE_COOKIES) ||
        !isset(process.env.NODEMAILER_TRANSPORT) ||
        !isset(process.env.FORCE_SSL)) {
    console.error("Error: Please set the proper authentication config variables in heroku.");
    process.exit(1);
}

// Create authentication object with all necessary info.
const auth = {
    env: process.env.NODE_ENV || 'dev',
    sessionSecret: process.env.SESSION_SECRET,
    useSecureCookies: process.env.USE_SECURE_COOKIES == true,
    forceSsl: process.env.FORCE_SSL == true,
    secretKey: process.env.SECRET_KEY,
    google: {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    mongoDB: {
        URL: process.env.MONGO_DB_URL
    },
    redisURL: process.env.REDISCLOUD_URL,
    nodemailerTransport: process.env.NODEMAILER_TRANSPORT
};

module.exports = auth;