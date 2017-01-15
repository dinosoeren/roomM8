/* Code adapted from: https://scotch.io/tutorials/easy-node-authentication-setup-and-local */
const fs = require('fs');
const User = require('./models/user');
const sanitizeMongo = require('mongo-sanitize');
const sanitizeHtml = require('sanitize-html');
const shOptions = { allowedTags: [], allowedAttributes: [] };
const nodemailer = require('nodemailer'); // Send emails.
const ejs = require('ejs'); // HTML javascript template engine.
const juice = require('juice'); // CSS inliner tool.

module.exports = function(app, auth, passport) {

    // Create reusable transporter object using the default SMTP transport.
    var transporter = nodemailer.createTransport(auth.nodemailerTransport);

    // Load home page with results from DB.
    app.get('/', (req, res) => {
        // Get locations.
        var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
        // If a deleteToken has been set through google authentication,
        // give it a new value on every page load, just for added security.
        if(req.session.deleteToken)
            req.session.deleteToken = genNewToken();
        var pageData = {
            locations: locations,
            user: req.user,
            allowedAccess: req.session ? req.session.allowedAccess : false,
            deleteToken: req.session ? req.session.deleteToken : null,
            errors: req.flash('error'),
            success: req.flash('success')
        };
        res.render('pages/index', pageData);
    });

    // Post roommates search query.
    app.post('/api/search', (req, res) => {
        if (!req.isAuthenticated() || typeof req.user.age === "undefined")
            return res.json({ error: 'Not authenticated.' });
        if (!req.body.query)
            return res.json({ error: 'Invalid query.' });
        var query = sanitizeMongo(req.body.query);
        User.findPotentialRoommates(query, req.user, (err, roomies) => {
            if(err)
                return res.json({ error: err });
            res.json(roomies);
        });
    });

    // Parse registration form.
    app.post('/', isLoggedIn, isValidRegistrationForm, (req, res) => {
        var user = req.user;
        var isUpdate = user.age ? true : false; // If age is already set, this is an update.
        var query = { 'googleId' : sanitizeMongo(user.googleId) };
        var newData = sanitizeMongo(parseUserData(req.body));
        User.findOneAndUpdate(query, newData, {upsert:false}, (err, doc) => {
            if (err) {
                console.error(err.message);
                if (isUpdate) {
                    req.flash('error', 'Failed to update profile. Please try again.');
                } else {
                    req.flash('error', 'Registration failed. Please try again.');
                }
                return res.redirect("/");
            }
            if (isUpdate) {
                req.flash('success', 'Profile was successfully updated!');
            } else {
                req.flash('success', 'Welcome to roomM8!');
            }
            return res.redirect("/");
        });
    });

    // Post keyphrase.
    app.post('/api/access', (req, res) => {
        if (typeof req.body.key === "undefined")
            return res.json({ error: 'Invalid key.' });
        var sess = req.session;
        if(!sess)
            return res.json({ error: 'Unknown error occurred.' });
        // Only allow 5 incorrect attempts per session.
        if(sess.accessAttempts && sess.accessAttempts >= 5)
            return res.json({ error: 'Too many attempts.' });
        var key_given = req.body.key;
        if (key_given === auth.secretKey) {
            sess.allowedAccess = true;
            sess.accessAttempts = 0;
            res.json({success: true});
        } else {
            // Incorrect keyphrase!
            if(sess.accessAttempts) {
                sess.accessAttempts++;
            } else {
                sess.accessAttempts = 1;
            }
            res.json({ error: 'Incorrect key. '+(5-sess.accessAttempts)+' more attempts.' });
        }
    });

    app.get('/test/email', isLoggedIn, isRegistered, (req, res) => {
        // Get locations.
        var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
        var emailPageData = {
            locations: locations,
            user: req.user,
            recipientName: "[Recipient]",
            subject: "[Subject]",
            message: "[Your message goes here]",
            startDate: formatDateNumToWords(req.user.startDate)
        };
        // Render email using EJS.
        ejs.renderFile('views/pages/email.ejs', emailPageData, (err, result) => {
            if(err)
                return res.json({ error: 'Unable to render email. Please try again.' });
            var initialHTML = result;
            var options = {
                webResources: { 
                    scripts: false,
                    relativeTo: "public/css"
                }
            };
            // Convert all CSS rules to inline.
            juice.juiceResources(initialHTML, options, (err, htmlPage) => {
                if(err)
                    return res.json({ error: 'Unable to set inline CSS in email. Please try again.' });
                res.send(htmlPage);
            });
        });
    });

    // Message another user.
    app.post('/message', isLoggedIn, isRegistered, (req, res) => {
        if (!isset(req.body.recipientID) ||
                !isset(req.body.subject) ||
                !isset(req.body.message))
            return res.json({ error: 'Please complete all required fields and try again.' });
        // Find user from recipientID.
        User.findById(sanitizeMongo(req.body.recipientID), (err, recipient) => {
            if(err)
                return res.json({ error: 'That user does not exist.' });
            // Make sure this is a new recipient (enforce single message policy).
            if(req.user.mailRecipients.includes(req.body.recipientID))
                return res.json({ error: 'You have already messaged this user. '+
                                'Please wait for them to respond via email.' });
            // Parse email address from transport string.
            var email = auth.nodemailerTransport.split(':')[1]
                        .replace('//', '').replace('%40', '@');
            // Get locations.
            var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
            // Setup html email
            var emailPageData = {
                locations: locations,
                user: req.user,
                recipientName: recipient.name,
                subject: sanitizeInput(req.body.subject),
                message: sanitizeInput(req.body.message, 1000),
                startDate: formatDateNumToWords(req.user.startDate)
            };
            // Render email using EJS.
            ejs.renderFile('views/pages/email.ejs', emailPageData, (err, result) => {
                if(err)
                    return res.json({ error: 'Unable to render email. Please try again.' });
                var initialHTML = result;
                var options = {
                    webResources: { 
                        scripts: false,
                        relativeTo: "public/css"
                    }
                };
                // Convert all CSS rules to inline.
                juice.juiceResources(initialHTML, options, (err, htmlPage) => {
                    if(err)
                        return res.json({ error: 'Unable to set inline CSS in email. Please try again.' });
                    // Setup message.
                    var mailOptions = {
                        from: '"roomM8" <'+email+'>',
                        replyTo: '"'+req.user.name+'" <'+req.user.email+'>',
                        to: '"'+recipient.name+'" <'+recipient.email+'>', 
                        subject: "New message from " + req.user.name + ": " + sanitizeInput(req.body.subject),
                        text: sanitizeInput(req.body.message, 1000),
                        html: htmlPage
                    };
                    // Send mail with defined transport object.
                    transporter.sendMail(mailOptions, (error, info) => {
                        if(error)
                            return res.json({ error: 'Email failed to send.' });
                        // Now update the current user's list of recipients.
                        User.addMailRecipient(req.user._id, req.body.recipientID, (err) => {
                            return res.json({ success: true });
                        });
                    });
                });
            });
        });
    });

    // Logout
    app.get('/logout', isLoggedIn, (req, res) => {
        req.logout();
        req.session.regenerate(function(err) {
            if(err)
                console.error(err);
        });
        req.flash('success', 'You have successfully signed out.');
        res.redirect('/');
    });

    // Delete this user!
    app.post('/deleteMe', isLoggedIn, isRegistered, (req, res) => {
        // Make sure user has agreed to delete and the session delete token
        // is the same as the posted delete token. Since a delete token can
        // only be given to the session after google authentication, this
        // will help ensure attackers cannot maliciously delete users.
        if(!isset(req.body.agreeToDelete) || !isset(req.body.deleteToken) ||
                !req.session.deleteToken || parseInt(req.body.deleteToken) !== req.session.deleteToken) {
            req.flash('error', 'Your account was not deleted. Please indicate that you understand the consequences and try again.');
            return res.redirect('/');
        }
        User.removeByGoogleId(req.user, (err) => {
            if(err) {
                req.flash('error', 'Your account was not deleted. Please try again.');
                return res.redirect('/');;
            }
            // Deletion successful. Logout.
            req.logout();
            req.flash('success', 'Your account was successfully deleted.');
            res.redirect('/');
        });
    });

    // Send to Google to do the authentication.
    // Profile gets basic info including name.
    app.get('/auth/google',
        passport.authenticate('google', {
            scope: ['profile', 'email']
        })
    );

    // Callback after Google has authenticated the user.
    app.get('/auth/google/callback', (req, res, next) => {
        passport.authenticate('google', (err, user, info) => {
            if (err)
                return next(err);
            if (!user) 
                return res.redirect('/');
            if (info.new_user === true) {
                if (req.session && req.session.allowedAccess) {
                    // User is allowed access. Save the new user!
                    user.save((err) => {
                        if (err)
                            throw err;
                        req.logIn(user, function(err) {
                            if (err)
                                return next(err);
                            // Create random token to use to confirm deletion.
                            req.session.deleteToken = genNewToken();
                            return res.redirect('/#success');
                        });
                    });
                } else {
                    // User is not allowed access!
                    if(req.session)
                        req.flash('error', 'You cannot sign up until you enter the correct keyphrase!');
                    return res.redirect('/');
                }
            } else {
                // Old user that already exists.
                req.logIn(user, function(err) {
                    if (err) { return next(err); }
                    // Create random token to use to confirm deletion.
                    req.session.deleteToken = genNewToken();
                    // If the user has completed registration, redirect to browsing page.
                    if(user.age) {
                        req.flash('success', 'Welcome back!');
                        return res.redirect('/');
                    }
                    // Otherwise, prompt to complete registration.
                    return res.redirect('/#success');
                });
            }
        })(req, res, next);
    });

};

// Route middleware to make sure user has entered keyphrase.
function hasEnteredKey(req, res, next) {
    if (req.session && req.session.allowedAccess)
        return next();
    res.redirect('/');
}

// Route middleware to make sure a user is logged in.
function isLoggedIn(req, res, next) {
    // If user is authenticated in the session, carry on.
    if (req.isAuthenticated())
        return next();
    // If they aren't, redirect them to the home page.
    req.flash('error', 'You are not signed in. Please sign in and try again.');
    res.redirect('/');
}

// Route middleware to make sure a user has fully completed their registration.
function isRegistered(req, res, next) {
    // If user has a value for the age field, carry on.
    if (typeof req.user.age !== 'undefined')
        return next();
    // If it doesn't, redirect them to the home page.
    req.flash('error', 'You have not completed your registration. Please finish signing up and try again.');
    res.redirect('/');
}

// Route middleware to make sure registration form is valid.
function isValidRegistrationForm(req, res, next) {
    if(isset(req.body.age) && 
            isset(req.body.field) && 
            isset(req.body.role) && 
            isset(req.body.position) && 
            isset(req.body.startDate) && 
            isset(req.body.startLocation) &&
            isset(req.body.hasPlace) &&
            isset(req.body.factorCleanliness) &&
            isset(req.body.factorQuietTime) &&
            isset(req.body.factorSubstanceFree) &&
            isset(req.body.factorSameGender) &&
            isset(req.body.factorSameAge) &&
            isset(req.body.factorSameField) &&
            isset(req.body.agree1) &&
            // Either preferences or current residence.
            (isset(req.body.prefLocations) || 
                isset(req.body.resLocation))) {
        return next();
    }
    req.flash('error', 'You did not fill in all the required fields. Please try again.');
    res.redirect('/');
}
function isset(a) {
    return typeof a !== "undefined" && a !== null && a !== "";
}

// Parse form data into user object, making sure to sanitize it first.
function parseUserData(body) {
    var newData = {
        age: sanitizeInput(body.age),
        field: sanitizeInput(body.field),
        role: sanitizeInput(body.role),
        position: sanitizeInput(body.position),
        startDate: sanitizeInput(body.startDate),
        startLocation: parseInt(sanitizeInput(body.startLocation)),
        hasPlace: (body.hasPlace === "yes"),
        agree1: true,
        agree2: true,
        factors: {
            cleanliness: parseInt(sanitizeInput(body.factorCleanliness)),
            quietTime: parseInt(sanitizeInput(body.factorQuietTime)),
            substanceFree: parseInt(sanitizeInput(body.factorSubstanceFree)),
            sameGender: parseInt(sanitizeInput(body.factorSameGender)),
            sameAge: parseInt(sanitizeInput(body.factorSameAge)),
            sameField: parseInt(sanitizeInput(body.factorSameField))
        }
    };
    if(body.aboutMe) {
        newData.aboutMe = sanitizeInput(body.aboutMe, 400);
    }
    if(!newData.hasPlace) {
        newData.preferences = {
            locations: sanitizeArray(body.prefLocations),
            residenceType: sanitizeInput(body.prefResidenceType),
            roommates: parseInt(sanitizeInput(body.prefRoommates)),
            durationInMonths: body.prefDuration ? parseInt(sanitizeInput(body.prefDuration)) : -1,
            maxCommuteTimeInMins: parseInt(sanitizeInput(body.prefMaxCommuteTime))
        };
        newData.factors.location = parseInt(sanitizeInput(body.factorLocation));
        newData.factors.residenceType = parseInt(sanitizeInput(body.factorResidence));
        newData.factors.ownBedroom = parseInt(sanitizeInput(body.factorOwnBedroom));
        newData.factors.ownBathroom = parseInt(sanitizeInput(body.factorOwnBathroom));
        newData.factors.commuteTime = parseInt(sanitizeInput(body.factorCommuteTime));
    } else {
        newData.currentResidence = {
            location: sanitizeInput(body.resLocation),
            residenceType: sanitizeInput(body.resType),
            vacantRooms: parseInt(sanitizeInput(body.resBedrooms)),
            bathrooms: parseInt(sanitizeInput(body.resBathrooms)),
            durationInMonths: body.resDuration ? parseInt(sanitizeInput(body.resDuration)) : -1,
            commuteTimeInMins: parseInt(sanitizeInput(body.resCommuteTime))
        };
    }
    return newData;
}
// Html-Sanitize data inputted by the user.
// Also enforce maximum character limit.
function sanitizeInput(input, maxChar=30) {
    return sanitizeHtml(input, shOptions).substring(0, maxChar);
}
// Html-Sanitize the data in an array.
function sanitizeArray(arr) {
    for(var i=0; i<arr.length; i++) {
        arr[i] = sanitizeInput(arr[i]);
    }
    return arr;
}
// Format date. Convert from '2017-09' to 'September 2017'
function formatDateNumToWords(dateString) {
    var options = {
        year: "numeric", month: "long"
    };
    return new Date(dateString+"-02").toLocaleDateString("en-US", options);
};

function genNewToken() {
    return getRandomInt(1000000000, 
                        9999999999);
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}