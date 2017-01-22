const mongoose = require('mongoose');
const UserValues = require('./user-values');
const moment = require('moment');
const auth = require('../../config/auth');

var userSchema = mongoose.Schema({
    googleId: {type: String, unique: true, required: true},
    token: {type: String, required: true},
    email: {type: String, required: true},
    name: {type: String, required: true},
    dateCreated: {type: Date, required: true, default: Date.now},
    completedRegistration: {type: Boolean, required: true, default: false},
    displayProfile: {type: Boolean, required: true, default: true},
    photoUrl: String,
    dateOfBirth: Date,
    gender: String,
    genderCustom: String,
    showAge: {type: Boolean, required: true, default: true},
    showGender: {type: Boolean, required: true, default: true},
    field: String,
    fieldCustom: String,
    role: String,
    roleCustom: String,
    position: String,
    startDate: String,
    startLocation: Number,
    hasPlace: Boolean,
    preferences: {
        locations: [String],
        residenceType: String,
        roommates: [Number],
        durationInMonths: Number,
        maxCommuteTimeInMins: Number
    },
    currentResidence: {
        location: String,
        residenceType: String,
        residenceTypeCustom: String,
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
},
{
    toJSON: { virtuals: true }
});

// Calculate user age from date of birth.
userSchema.virtual('age').get(function () {
    var dob = moment(this.dateOfBirth).utc();
    return moment().utc().diff(dob, 'years');
});

// Get a sorted list of user's factor ratings.
userSchema.virtual('sortedFactors').get(function() {
    var factorsDict;
    if(this.hasPlace)
        factorsDict = UserValues.factors.hasPlace;
    else
        factorsDict = UserValues.factors.all;
    var topFactors = [];
    for(var i=0; i<factorsDict.length; i++) {
        if(this.factors.hasOwnProperty(factorsDict[i])) {
            topFactors.push({
                factor : factorsDict[i],
                rating : this.factors[factorsDict[i]]
            });
        }
    }
    topFactors.sort(function(a, b) {
        return b.rating - a.rating;
    });
    return topFactors;
});

// Generate object to specify priority and order of sorted fields.
function generateSortByFields(user) {
    var sortBy = {};
    // If age is important to user, show results with age showing first.
    if(user.factors.sameAge > 2)
        sortBy["showAge"] = -1;
    // If gender is important to user, show results with gender showing first.
    if(user.factors.sameGender > 2)
        sortBy["showGender"] = -1;
    // Only include factors that all users have 
    // (so that results are not biased against users with residences).
    var userTopFactors = user.sortedFactors;
    for(var i=0; i<userTopFactors.length; i++) {
        if(UserValues.factors.hasPlace.includes(userTopFactors[i].factor)) {
            // If current user rated this factor high (2 or 3), put in descending order.
            var order = userTopFactors[i].rating > 1 ? -1 : 1;
            sortBy["factors."+userTopFactors[i].factor] = order;
        }
    }
    // Finally, show newer users first.
    sortBy["dateCreated"] = -1;
    return sortBy;
}

var selectRows = { 
    _id: 1,
    name: 1,
    photoUrl: 1,
    gender: 1,
    genderCustom: 1,
    dateOfBirth: 1,
    age: 1,
    showAge: 1,
    showGender: 1,
    field: 1,
    fieldCustom: 1,
    role: 1,
    roleCustom: 1,
    position: 1,
    aboutMe: 1,
    startDate: 1,
    startLocation: 1,
    hasPlace: 1,
    preferences: 1,
    currentResidence: 1,
    factors: 1,
    sortedFactors: 1
};

userSchema.statics.findPotentialRoommates = function(query, user, callback) {
    var findData = {
        // Different google id from current user.
        googleId: { $ne: user.googleId },
        // Make sure they are fully registered.
        completedRegistration: true,
        // Make sure they wish to be listed publicly.
        displayProfile: true
    };
    if(query.name)
        findData.name = new RegExp(query.name, 'i');
    if(query.startLocation)
        findData.startLocation = query.startLocation
    this.find(findData).
    sort(generateSortByFields(user)).
    skip(query.skip ? parseInt(query.skip) : 0).
    limit(query.limit ? parseInt(query.limit) : 20).
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

module.exports = mongoose.model(auth.env === 'dev' ? 'TestUsers' : 'Users', userSchema);