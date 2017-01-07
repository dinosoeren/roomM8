// Make sure proper variables have been set.
if(!process.env.sessionSecret ||
    !process.env.secretKey ||
    !process.env.googleClientID ||
    !process.env.googleClientSecret ||
    !process.env.googleCallbackURL ||
    !process.env.mongoDBURL) {
        console.error("Error: Please set the proper authentication config variables in heroku.");
        process.exit(1);
}

// Create authentication object with all necessary info.
const auth = {
    sessionSecret: process.env.sessionSecret,
    secretKey: process.env.secretKey,
    google: {
        clientID: process.env.googleClientID,
        clientSecret: process.env.googleClientSecret,
        callbackURL: process.env.googleCallbackURL
    },
    mongoDB: {
        URL: process.env.mongoDBURL
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
    cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// Load routes: pass in app, auth info, and fully configured passport.
require('./app/routes')(app, auth, passport);

// Launch
app.listen(port);
console.log('Listening on port ' + port);