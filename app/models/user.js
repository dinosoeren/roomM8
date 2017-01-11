const mongoose = require('mongoose');

var userSchema = mongoose.Schema({
    googleId: {type: String, unique: true, required: true},
    token: {type: String, required: true},
    email: {type: String, required: true},
    name: {type: String, required: true},
    photoUrl: String,
    gender: String,
    age: Number,
    field: String,
    role: String,
    position: String,
    startDate: String,
    startLocation: Number,
    hasPlace: Boolean,
    preferences: {
        locations: [String],
        residenceType: String,
        roommates: Number,
        durationInMonths: Number,
        maxCommuteTimeInMins: Number
    },
    currentResidence: {
        location: String,
        residenceType: String,
        vacantRooms: Number,
        bathrooms: Number,
        durationInMonths: Number,
        commuteTimeInMins: Number
    },
    factors: {
        location: Number,
        residenceType: Number,
        ownBedroom: Number,
        ownBathroom: Number,
        commuteTime: Number,
        cleanliness: Number,
        quietTime: Number,
        substanceFree: Number,
        sameGender: Number,
        sameAge: Number,
        sameField: Number
    },
    aboutMe: String,
    mailRecipients: [String],
    agree1: Boolean,
    agree2: Boolean
});

var selectRows = { 
    _id: 1,
    name: 1,
    photoUrl: 1,
    gender: 1,
    age: 1,
    field: 1,
    role: 1,
    position: 1,
    aboutMe: 1,
    startDate: 1,
    startLocation: 1,
    hasPlace: 1,
    preferences: 1,
    currentResidence: 1,
    factors: 1
};

userSchema.statics.findPotentialRoommates = function(user, callback) {
    this.find({
        googleId: { $ne: user.googleId }, // different google id
        startLocation: user.startLocation // same start location
    }).
    limit(20).
    select(selectRows).
    exec(callback);
};
userSchema.statics.findPotentialRoommatesLike = function(query, user, callback) {
    this.find({
        name: new RegExp(query, 'i'), // name LIKE query
        googleId: { $ne: user.googleId }, // different google id
        startLocation: user.startLocation // same start location
    }).
    limit(20).
    select(selectRows).
    exec(callback);
};
userSchema.statics.findById = function(id, callback) {
    this.findOne({
        _id: id
    }).
    exec(callback);
};
userSchema.statics.addMailRecipient = function(userId, recipientId, callback) {
    var query = {
        _id: userId
    };
    var newData = {
        $push: {
            mailRecipients: recipientId
        }
    };
    this.findOneAndUpdate(query, newData, {upsert:false}).
    exec(callback);
};
userSchema.statics.removeByGoogleId = function(user, callback) {
    this.findOne({
        googleId: user.googleId
    }).
    remove().
    exec(callback);
};

module.exports = mongoose.model('User', userSchema);