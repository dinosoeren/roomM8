const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const User = require('../app/models/user');

/* Code adapted from: https://scotch.io/tutorials/easy-node-authentication-google */

module.exports = function(auth, passport) {

    // Serialize the user for the session.
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize the user.
    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) => {
            done(err, user);
        });
    });

    // GOOGLE
    passport.use(
        new GoogleStrategy({
            clientID: auth.google.clientID,
            clientSecret: auth.google.clientSecret,
            callbackURL: auth.google.callbackURL
        },
        function(token, refreshToken, profile, done) {
            // Make the code asynchronous.
            // User.findOne won't fire until we have all our data back from Google.
            process.nextTick(function() {
                // Try to find the user based on their google id.
                var query = { 'googleId' : profile.id };
                User.findOne(query, (err, user) => {
                    if (err)
                        return done(err);
                    if (user) {
                        // If a user is found, log them in
                        return done(null, user);
                    } else {
                        // If the user isn't in database, create a new user
                        var newUser = new User();
                        // Set all relevant information
                        newUser.googleId = profile.id;
                        newUser.token = token;
                        newUser.name = profile.displayName;
                        newUser.email = profile.emails[0].value;
                        newUser.gender = profile.gender;
                        if(profile.photos.length > 0) {
                            newUser.photoUrl = profile.photos[0].value.replace(/\?sz=[0-9]+/, "?sz=250");
                        }
                        // Return the new user without saving it.
                        return done(null, newUser, { new_user: true });
                    }
                });
            });
        })
    );

};