/* Code adapted from: https://scotch.io/tutorials/easy-node-authentication-setup-and-local */
const fs = require('fs');
const User = require('./models/user');
const sanitize = require('mongo-sanitize');

module.exports = function(app, auth, passport) {

    // Load home page with results from DB.
    app.get('/', (req, res) => {
        // Get locations.
        var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
        // Render index page.
        res.render('pages/index', {
            roomies: [],
            locations: locations,
            user: req.user,
            errors: req.flash('error'),
            success: req.flash('success')
        });
    });

    // Parse registration form.
    app.post('/', isLoggedIn, validRegistrationForm, (req, res) => {
        var user = req.user;
        var isUpdate = user.age ? true : false; // If age is already set, this is an update.
        var query = { 'googleId' : sanitize(user.googleId) };
        var newData = sanitize(parseUserData(req.body));
        User.findOneAndUpdate(query, newData, {upsert:false}, (err, doc) => {
            if (err) {
                console.log(err.message);
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
        var sess = req.session;
        // only allow 5 incorrect attempts per session
        if(sess.accessAttempts && sess.accessAttempts >= 5) {
            res.json({error: 'Too many attempts.'});
            return;
        }
        var key_given = req.body.key;
        if (key_given === auth.secretKey) {
            sess.allowedAccess = true;
            sess.accessAttempts = 0;
            res.json({success: true});
        } else {
            // incorrect keyphrase
            if(sess.accessAttempts) {
                sess.accessAttempts++;
            } else {
                sess.accessAttempts = 1;
            }
            res.json({error: 'Incorrect key. '+(5-sess.accessAttempts)+' more attempts.'});
        }
    });

    // Logout
    app.get('/logout', (req, res) => {
        req.logout();
        req.flash('success', 'You have successfully signed out.');
        res.redirect('/');
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
            if (err) { return next(err); }
            if (!user) { return res.redirect('/'); }
            if (info.new_user === true) {
                if (req.session.allowedAccess) {
                    // User is allowed access. Save the new user!
                    user.save((err) => {
                        if (err)
                            throw err;
                        req.logIn(user, function(err) {
                            if (err) { return next(err); }
                            return res.redirect('/#success');
                        });
                    });
                } else {
                    // User is not allowed access!
                    req.flash('error', 'You cannot sign up until you enter the correct keyphrase!');
                    return res.redirect('/');
                }
            } else {
                // Old user that already exists.
                req.logIn(user, function(err) {
                    if (err) { return next(err); }
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
    if (req.session.allowedAccess)
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

// Route middleware to make sure registration form is valid.
function validRegistrationForm(req, res, next) {
    if(req.body.age && 
            req.body.field && 
            req.body.role && 
            req.body.startDate && 
            req.body.startLocation &&
            req.body.hasPlace &&
            req.body.factorCleanliness &&
            req.body.factorQuietTime &&
            req.body.factorSubstanceFree &&
            req.body.factorSameGender &&
            req.body.factorSameAge &&
            req.body.factorSameField) {
        return next();
    }
    req.flash('error', 'You did not fill in all the required fields. Please try again.');
    res.redirect('/');
}

// Convert form data into user object.
function parseUserData(body) {
    var newData = {
        age: body.age,
        field: body.field,
        role: body.role,
        startDate: body.startDate,
        startLocation: body.startLocation,
        hasPlace: (body.hasPlace === "yes"),
        factors: {
            cleanliness: body.factorCleanliness,
            quietTime: body.factorQuietTime,
            substanceFree: body.factorSubstanceFree,
            sameGender: body.factorSameGender,
            sameAge: body.factorSameAge,
            sameField: body.factorSameField
        }
    };
    if(body.aboutMe) {
        newData.aboutMe = body.aboutMe;
    }
    if(!newData.hasPlace) {
        newData.preferences = {
            locations: body.prefLocations,
            residenceType: body.prefResidenceType,
            roommates: body.prefRoommates,
            durationInMonths: body.prefDuration,
            maxCommuteTimeInMins: body.prefMaxCommuteTime
        };
        newData.factors.location = body.factorLocation;
        newData.factors.residenceType = body.factorResidence;
        newData.factors.ownBedroom = body.factorOwnBedroom;
        newData.factors.ownBathroom = body.factorOwnBathroom;
        newData.factors.commuteTime = body.factorCommuteTime;
    } else {
        newData.currentResidence = {
            location: body.resLocation,
            type: body.resType,
            vacantRooms: body.resBedrooms,
            bathrooms: body.resBathrooms,
            durationInMonths: body.resDuration,
            commuteTimeInMins: body.resCommuteTime
        };
    }
    return newData;
}