// Make sure proper variables have been set.
if(!process.env.SESSION_SECRET ||
    !process.env.SECRET_KEY ||
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_CALLBACK_URL ||
    !process.env.MONGO_DB_URL) {
        console.error("Error: Please set the proper authentication config variables in heroku.");
        process.exit(1);
}

// Create authentication object with all necessary info.
const auth = {
    sessionSecret: process.env.SESSION_SECRET,
    secretKey: process.env.SECRET_KEY,
    google: {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    mongoDB: {
        URL: process.env.MONGO_DB_URL
    }
};

// Primary app dependencies.
const flash = require('connect-flash');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const bodyParser= require('body-parser');
const cookieParser= require('cookie-parser');

// Connect to MongoDB database.
mongoose.connect(auth.mongoDB.URL);

// Configure passport.
require('./config/passport')(auth, passport);

// Keep/read cookies (required to use oauth).
app.use(cookieParser());
// Extract data from <form> elements and add to request body.
app.use(bodyParser.urlencoded({extended: true}));
// Use Embedded Javascript as the template engine.
app.set('view engine', 'ejs');
// Always serve files in public (css, js, images, etc).
app.use(express.static('public'));
// Use flash to send messages over middleware.
app.use(flash());

// Init session for passport.
app.use(session({
    secret: auth.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// Load routes: pass in app, auth info, and fully configured passport.
require('./app/routes')(app, auth, passport);

// Launch
app.listen(port);
console.log('Listening on port ' + port);