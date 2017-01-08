// Private auth info.
const auth = require('./config/auth');

// Primary app dependencies.
const flash = require('connect-flash');
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const passport = require('passport');
const bodyParser= require('body-parser');
const cookieParser= require('cookie-parser');
const session = require('./config/sessions');

// Configure mongoDB database.
require('./config/database')(auth)

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
// Init session for passport authentication library.
app.use(session(auth));
app.use(passport.initialize());
 // Persistent login sessions.
app.use(passport.session());

// Load routes: pass in app, auth info, and fully configured passport.
require('./app/routes')(app, auth, passport);

// Launch
app.listen(port);
console.log('Listening on port ' + port);