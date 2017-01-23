// Private auth info.
const auth = require('./config/auth');

// Primary app dependencies.
const flash = require('connect-flash');
const compression = require('compression');
const minify = require('express-minify');
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
// Use flash to send messages over middleware.
app.use(flash());
// Init session for passport authentication library.
app.use(session(auth));
app.use(passport.initialize());
 // Persistent login sessions.
app.use(passport.session());
 // Enable compression for faster response times.
app.use(compression());

// Load routes: pass in app, auth info, and fully configured passport.
require('./app/routes')(app, auth, passport);

// Minify and cache CSS and JS files.
app.use(function(req, res, next)
{
    // for all *.min.css or *.min.js, do not minify it 
    if (/\.min\.(css|js)$/.test(req.url)) {
        res._no_minify = true;
    }
    next();
});
app.use(minify());
// Always serve files in public (css, js, images, etc).
app.use(express.static(__dirname + '/public'));

// Launch
app.listen(port);
console.log('Listening on port ' + port);