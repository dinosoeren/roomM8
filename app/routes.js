/* Code adapted from: https://scotch.io/tutorials/easy-node-authentication-setup-and-local */
const fs = require('fs');
const User = require('./models/user');
const UserValues = require('./models/user-values');
const sanitizeMongo = require('mongo-sanitize');
const sanitizeHtml = require('sanitize-html');
const shOptions = { allowedTags: [], allowedAttributes: [] };
const nodemailer = require('nodemailer'); // Send emails.
const moment = require('moment'); // Format dates.
const ejs = require('ejs'); // HTML javascript template engine.
const juice = require('juice'); // CSS inliner tool.
const juiceClient = require('juice/client');

// Standard settings for juice CSS inlining.
var juiceOptions = {
    preserveFontFaces: false,
    webResources: { 
        scripts: false,
        relativeTo: "public/css"
    }
};
// Exclude these CSS properties from any juice inlining.
juiceClient.excludedProperties = [
    '-moz-box-sizing', 
    '-webkit-box-sizing', 
    'font-style',
    'line-height',
    '-webkit-font-smoothing',
    '-moz-osx-font-smoothing',
    'margin-left',
    'margin-right',
    'padding-left',
    'padding-right',
    '-webkit-box-shadow',
    'box-shadow',
    'position'
];

module.exports = function(app, auth, passport) {

    // Create reusable transporter object using the default SMTP transport for sending emails.
    var transporter = nodemailer.createTransport(auth.nodemailerTransport);

    // Load home page.
    app.get('/', (req, res) => {
        // Get locations.
        var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
        // Minimum age users are allowed to be.
        var minUserAge = 18;
        // Generate new tokens on every page load.
        req.session.registerToken = genNewToken(); // used for registration and profile edits
        if(req.session.deleteToken)
            req.session.deleteToken = genNewToken();
        if (req.user) {
            req.session.searchToken = genNewToken(); // used for searching for roommates
            req.session.toggleToken = genNewToken(); // used for toggling profile visibility
        }
        // Add formatted date of birth and age to user object.
        if(req.user) {
            var userDOB = moment(req.user.dateOfBirth).utc();
            req.user.dateOfBirthFormatted = userDOB.format('YYYY-MM-DD');
        }
        // Assemble page data.
        var pageData = {
            locations: locations,
            user: req.user,
            allowedAccess: req.session ? req.session.allowedAccess : false,
            deleteToken: req.session ? req.session.deleteToken : null,
            registerToken: req.session ? req.session.registerToken : null,
            searchToken: req.session ? req.session.searchToken : null,
            toggleToken: req.session ? req.session.toggleToken : null,
            errors: req.flash('error'),
            success: req.flash('success'),
            maxDateOfBirth: moment().utc().subtract(minUserAge, 'years').format('YYYY-MM-DD')
        };
        res.render('pages/index', pageData);
    });

    // Handle registration/profile form submission.
    app.post('/', isLoggedIn, isValidRegistrationForm, (req, res) => {
        var isUpdate = req.user.completedRegistration ? true : false;
        var errorMessage = 'Registration failed. Please try again.';
        var successMessage = 'Welcome to roomM8!';
        if (isUpdate) {
            errorMessage = 'Failed to update profile. Please try again.';
            successMessage = 'Profile was successfully updated!';
        }
        // Make sure session token is valid before proceeding.
        if(!req.session.registerToken || parseInt(req.body.registerToken) !== req.session.registerToken) {
            req.flash('error', errorMessage);
            return res.redirect('/');
        }
        var query = { 'googleId' : sanitizeMongo(req.user.googleId) };
        var newData = sanitizeMongo(parseUserData(req.body));
        // Make sure newData is valid before proceeding.
        if(typeof newData === "string") {
            console.error("Data submitted was invalid: "+newData);
            req.flash('error', errorMessage);
            return res.redirect("/");
        }
        User.findOneAndUpdate(query, newData, {upsert:false}, (err, doc) => {
            if (err) {
                console.error(err.message);
                req.flash('error', errorMessage);
                return res.redirect("/");
            }
            if (isUpdate) {
                req.flash('success', successMessage);
                return res.redirect("/");
            } else {
                // Send confirmation email after new user registration.
                // Parse email address from transport string.
                var email = auth.nodemailerTransport.split(':')[1]
                            .replace('//', '').replace('%40', '@');
                // Get locations.
                var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
                // Create user object for email.
                var user = newData;
                user.name = req.user.name;
                user.email = req.user.email;
                // Add age to user object.
                var userDOB = moment(user.dateOfBirth).utc();
                user.age = moment().utc().diff(userDOB, 'years');
                // Setup html email
                var emailPageData = {
                    email: true,
                    locations: locations,
                    user: user,
                    startDate: formatDateNumToWords(newData.startDate),
                    urlDate: moment().format('YYYY-MM-DD')
                };
                // Render email using EJS.
                ejs.renderFile('views/emails/new-user.ejs', emailPageData, (err, result) => {
                    if(err) {
                        req.flash('error', 'Unable to render email. Please try again.');
                        return res.redirect("/");
                    }
                    var initialHTML = result;
                    // Convert all CSS rules to inline.
                    juice.juiceResources(initialHTML, juiceOptions, (err, htmlPage) => {
                        if(err) {
                            req.flash('error', 'Unable to set inline CSS in email. Please try again.');
                            return res.redirect("/");
                        }
                        // Setup message.
                        var mailOptions = {
                            from: '"roomM8" <'+email+'>',
                            replyTo: '"roomM8" <'+email+'>',
                            to: '"'+user.name+'" <'+user.email+'>',
                            subject: "Welcome to roomM8!",
                            text: "Thank you for signing up for roomM8.",
                            html: htmlPage
                        };
                        // Send mail with defined transport object.
                        transporter.sendMail(mailOptions, (error, info) => {
                            if(error)
                                req.flash('error', 'Email failed to send.');
                            else
                                req.flash('success', successMessage);
                            return res.redirect("/");
                        });
                    });
                });
            }
        });
    });

    // Handle submission of secret code.
    app.post('/access', (req, res) => {
        if (typeof req.body.key === "undefined")
            return res.json({ error: 'Invalid passcode.' });
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
            res.json({ error: 'Incorrect passcode. '+(5-sess.accessAttempts)+' more attempts allowed.' });
        }
    });

    // Handle submission of a new Message to another user.
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
            // Add age to user object.
            var userDOB = moment(req.user.dateOfBirth).utc();
            req.user.age = moment().utc().diff(userDOB, 'years');
            // Setup html email
            var emailPageData = {
                email: true,
                locations: locations,
                user: req.user,
                recipientName: recipient.name,
                subject: sanitizeInput(req.body.subject),
                message: sanitizeInput(req.body.message, 1000),
                startDate: formatDateNumToWords(req.user.startDate),
                urlDate: moment().format('YYYY-MM-DD')
            };
            // Render email using EJS.
            ejs.renderFile('views/emails/user-message.ejs', emailPageData, (err, result) => {
                if(err)
                    return res.json({ error: 'Unable to render email. Please try again.' });
                var initialHTML = result;
                // Convert all CSS rules to inline.
                juice.juiceResources(initialHTML, juiceOptions, (err, htmlPage) => {
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

    // Preview an email message sent from the current user.
    app.get('/preview/email/message', isLoggedIn, isRegistered, (req, res) => {
        // Get locations.
        var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
        // Add age to user object.
        var userDOB = moment(req.user.dateOfBirth).utc();
        req.user.age = moment().utc().diff(userDOB, 'years');
        var emailPageData = {
            email: true,
            locations: locations,
            user: req.user,
            recipientName: "[Recipient]",
            subject: "[Subject]",
            message: "[Your message goes here]",
            startDate: formatDateNumToWords(req.user.startDate),
            urlDate: moment().format('YYYY-MM-DD')
        };
        // Render email using EJS.
        ejs.renderFile('views/emails/user-message.ejs', emailPageData, (err, result) => {
            if(err)
                return res.json({ error: 'Unable to render email. Please try again.' });
            var initialHTML = result;
            // Convert all CSS rules to inline.
            juice.juiceResources(initialHTML, juiceOptions, (err, htmlPage) => {
                if(err)
                    return res.json({ error: 'Unable to set inline CSS in email. Please try again.' });
                res.send(htmlPage);
            });
        });
    });

    // Preview the email sent upon first sign in.
    app.get('/preview/email/first-sign-in', isLoggedIn, isRegistered, (req, res) => {
        var emailPageData = {
            email: true,
            user: req.user
        };
        // Render email using EJS.
        ejs.renderFile('views/emails/first-sign-in.ejs', emailPageData, (err, result) => {
            if(err)
                return res.json({ error: 'Unable to render email. Please try again.' });
            var initialHTML = result;
            // Convert all CSS rules to inline.
            juice.juiceResources(initialHTML, juiceOptions, (err, htmlPage) => {
                if(err)
                    return res.json({ error: 'Unable to set inline CSS in email. Please try again.' });
                res.send(htmlPage);
            });
        });
    });

    // Preview an email sent to a newly registered user.
    app.get('/preview/email/new-user', isLoggedIn, isRegistered, (req, res) => {
        // Get locations.
        var locations = JSON.parse(fs.readFileSync('public/data/locations.json', 'utf8')).locations;
        // Add age to user object.
        var userDOB = moment(req.user.dateOfBirth).utc();
        req.user.age = moment().utc().diff(userDOB, 'years');
        var emailPageData = {
            email: true,
            locations: locations,
            user: req.user,
            startDate: formatDateNumToWords(req.user.startDate),
            urlDate: moment().format('YYYY-MM-DD')
        };
        // Render email using EJS.
        ejs.renderFile('views/emails/new-user.ejs', emailPageData, (err, result) => {
            if(err)
                return res.json({ error: 'Unable to render email. Please try again.' });
            var initialHTML = result;
            // Convert all CSS rules to inline.
            juice.juiceResources(initialHTML, juiceOptions, (err, htmlPage) => {
                if(err)
                    return res.json({ error: 'Unable to set inline CSS in email. Please try again.' });
                res.send(htmlPage);
            });
        });
    });

    // Logout the current user.
    app.get('/logout', isLoggedIn, (req, res) => {
        req.logout();
        req.session.regenerate(function(err) {
            if(err)
                console.error(err);
        });
        req.flash('success', 'You have successfully signed out.');
        res.redirect('/');
    });

    // Delete the current user permanently!
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

    // Toggle profile visibility in public listing.
    app.post('/profile/toggle/visibility', isLoggedIn, isRegistered, (req, res) => {
        if(!req.session.toggleToken || parseInt(req.body.toggleToken) !== req.session.toggleToken) {
            req.flash('error', 'Failed to update profile visibility. Please try again.');
            return res.redirect('/');
        }
        var user = req.user;
        var message = user.displayProfile ? "hidden from" : "displayed in";
        var query = { 'googleId' : sanitizeMongo(user.googleId) };
        var newData = { displayProfile: !user.displayProfile };
        User.findOneAndUpdate(query, newData, {upsert:false}, (err, doc) => {
            if (err) {
                console.error(err.message);
                req.flash('error', 'Failed to update profile visibility. Please try again.');
                return res.redirect("/");
            }
            req.flash('success', 'Your profile will now be '
                        +message+' public search results.');
            return res.redirect("/");
        });
    });

    // Handle submission of a new search query for roommates.
    app.post('/api/search', (req, res) => {
        if (!req.isAuthenticated() || !req.user.completedRegistration)
            return res.json({ error: 'Not authenticated.' });
        if (!req.body.query)
            return res.json({ error: 'Invalid query.' });
        if (!req.session.searchToken || parseInt(req.body.query.searchToken) !== req.session.searchToken)
            return res.json({ error: 'Invalid session token.' });
        var query = sanitizeMongo(req.body.query);
        User.findPotentialRoommates(query, req.user, (err, roomies) => {
            if(err)
                return res.json({ error: err });
            res.json(roomies);
        });
    });

    // Send to Google to do the authentication.
    // 'Profile' scope gets basic info including name.
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
                            return next(err);
                        // Log the user in.
                        req.logIn(user, function(err) {
                            if (err)
                                return next(err);
                            // Create random token to use to confirm deletion.
                            req.session.deleteToken = genNewToken();
                            // Finally, send 'not done yet' email after signing in for the first time.
                            // Parse email address from transport string.
                            var email = auth.nodemailerTransport.split(':')[1]
                                        .replace('//', '').replace('%40', '@');
                            // Setup html email.
                            var emailPageData = {
                                email: true,
                                user: user
                            };
                            // Render email using EJS.
                            ejs.renderFile('views/emails/first-sign-in.ejs', emailPageData, (err, result) => {
                                if(err) {
                                    req.flash('error', 'Unable to render email. Please try again.');
                                    return res.redirect("/");
                                }
                                var initialHTML = result;
                                // Convert all CSS rules to inline.
                                juice.juiceResources(initialHTML, juiceOptions, (err, htmlPage) => {
                                    if(err) {
                                        req.flash('error', 'Unable to set inline CSS in email. Please try again.');
                                        return res.redirect("/");
                                    }
                                    // Setup message.
                                    var mailOptions = {
                                        from: '"roomM8" <'+email+'>',
                                        replyTo: '"roomM8" <'+email+'>',
                                        to: '"'+user.name+'" <'+user.email+'>',
                                        subject: "roomM8 - You're almost done, "+user.name.split(' ')[0]+"!",
                                        text: "Please complete your profile to continue using roomM8.",
                                        html: htmlPage
                                    };
                                    // Send mail with defined transport object.
                                    transporter.sendMail(mailOptions, (error, info) => {
                                        if(error) {
                                            req.flash('error', 'Email failed to send.'+error);
                                            return res.redirect("/");
                                        }
                                        return res.redirect('/#success');
                                    });
                                });
                            });
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
                    if (err)
                        return next(err);
                    // Create random token to use to confirm deletion.
                    req.session.deleteToken = genNewToken();
                    // If the user has completed registration, redirect to browsing page.
                    if(user.completedRegistration) {
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

// Check if a variable is valid.
function isset(a) {
    return typeof a !== "undefined" && a !== null && a !== "";
}

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
    if (req.user.completedRegistration)
        return next();
    // If user has not registered, redirect them to the home page.
    req.flash('error', 'You have not completed your registration. Please finish signing up and try again.');
    res.redirect('/');
}

// Route middleware to make sure registration form is valid.
function isValidRegistrationForm(req, res, next) {
    if(isset(req.body.dateOfBirth) &&
            isset(req.body.gender) &&
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

// Parse form data into user object, making sure to sanitize it first.
function parseUserData(body) {
    // Make sure date of birth is valid.
    var dateOfBirth = moment(sanitizeInput(body.dateOfBirth));
    if(!dateOfBirth.isValid())
        return "date of birth"; // error
    // Make sure start date is valid.
    var startDate = moment(sanitizeInput(body.startDate), 'YYYY-MM');
    if(!startDate.isValid())
        return "start date"; // error
    // Make sure gender is valid.
    var gender = sanitizeInput(body.gender);
    if(!UserValues.genders.includes(gender))
        return "gender"; // error
    // Make sure field is valid.
    var field = sanitizeInput(body.field);
    if(!UserValues.fields.includes(field))
        return "field"; // error
    // Make sure role is valid.
    var role = sanitizeInput(body.role);
    if(!UserValues.roles.includes(role))
        return "role"; // error
    // Make sure startLocation is valid.
    var startLocation = parseInt(sanitizeInput(body.startLocation));
    if(startLocation < UserValues.startLocationMin || startLocation > UserValues.startLocationMax)
        return "start location"; // error
    var newData = {
        completedRegistration: true,
        dateOfBirth: dateOfBirth,
        gender: gender,
        showAge: (body.showAge === "yes"),
        showGender: (body.showGender === "yes"),
        field: field,
        role: role,
        position: sanitizeInput(body.position, 50),
        startDate: startDate.format('YYYY-MM'),
        startLocation: startLocation,
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
    if(body.genderCustom) {
        newData.genderCustom = sanitizeInput(body.genderCustom);
    }
    if(body.fieldCustom) {
        newData.fieldCustom = sanitizeInput(body.fieldCustom);
    }
    if(body.roleCustom) {
        newData.roleCustom = sanitizeInput(body.roleCustom);
    }
    if(!newData.hasPlace) {
        // Make sure residenceType is valid.
        var residenceType = sanitizeInput(body.prefResidenceType);
        if(!UserValues.preferenceResTypes.includes(residenceType))
            return "preference residence type"; // error
        // Make sure number of preferred roommates (range) is valid.
        var roommates = sanitizeInput(body.prefRoommates).split(',');
        if(roommates.length !== 2 || roommates[0] > roommates[1] || 
                roommates[0] < UserValues.roommatesMin || 
                roommates[1] < UserValues.roommatesMin ||
                roommates[0] > UserValues.roommatesMax || 
                roommates[1] > UserValues.roommatesMax)
            return "roommates"; // error
        newData.preferences = {
            locations: sanitizeArray(body.prefLocations),
            residenceType: residenceType,
            roommates: roommates,
            durationInMonths: body.prefDuration ? parseInt(sanitizeInput(body.prefDuration)) : -1,
            maxCommuteTimeInMins: parseInt(sanitizeInput(body.prefMaxCommuteTime))
        };
        newData.factors.location = parseInt(sanitizeInput(body.factorLocation));
        newData.factors.residenceType = parseInt(sanitizeInput(body.factorResidence));
        newData.factors.ownBedroom = parseInt(sanitizeInput(body.factorOwnBedroom));
        newData.factors.ownBathroom = parseInt(sanitizeInput(body.factorOwnBathroom));
        newData.factors.commuteTime = parseInt(sanitizeInput(body.factorCommuteTime));
    } else {
        // Make sure residenceType is valid.
        var residenceType = sanitizeInput(body.resType);
        if(!UserValues.currentResTypes.includes(residenceType))
            return "current residence type"; // error
        newData.currentResidence = {
            location: sanitizeInput(body.resLocation),
            residenceType: residenceType,
            vacantRooms: parseInt(sanitizeInput(body.resBedrooms)),
            bathrooms: parseInt(sanitizeInput(body.resBathrooms)),
            durationInMonths: body.resDuration ? parseInt(sanitizeInput(body.resDuration)) : -1,
            commuteTimeInMins: parseInt(sanitizeInput(body.resCommuteTime))
        };
        if(body.resTypeCustom) {
            newData.currentResidence.residenceTypeCustom = sanitizeInput(body.resTypeCustom);
        }
    }
    return newData;
}
// Html-Sanitize data inputted by the user.
// Also enforce maximum character limit.
function sanitizeInput(input, maxChar=30) {
    return sanitizeHtml(input, shOptions).substring(0, maxChar);
}
// Html-Sanitize the data in an array.
// Also enforce max length.
function sanitizeArray(arr, maxLength=10) {
    if(typeof arr !== "object")
        arr = [arr];
    var newArr = [];
    for(var i=0; i<Math.min(arr.length, maxLength); i++) {
        newArr.push(sanitizeInput(arr[i]));
    }
    return newArr;
}

// Format date. Convert from '2017-09' to 'September 2017'
function formatDateNumToWords(dateString) {
    var options = {
        year: "numeric", month: "long"
    };
    return new Date(dateString+"-02").toLocaleDateString("en-US", options);
}

// Generate new token for session.
function genNewToken() {
    return getRandomInt(1000000000, 
                        9999999999);
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}