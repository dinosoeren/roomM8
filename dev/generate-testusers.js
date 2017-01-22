// Script to generate random test users and insert them into mongo database.

const fs = require('fs');
const mi = require('mongoimport');
const randomName = require('random-name');
const UserValues = require('../app/models/user-values');
const argv = require('minimist')(process.argv.slice(2));

if(!argv['d'] ||
        !argv['c'] ||
        !argv['h'] ||
        !argv['u'] ||
        !argv['p'] ||
        !argv['gen']) {
    console.error("Error: Please enter the mongoDB connection & generator arguments.");
    console.log("-h <host>:<port> -d <database> -c <collection> -u <user> -p <password> --gen <number of test users>");
    process.exit(1);
}

// HELPER FUNCTIONS!

// Generate random number between min (inclusive) and max (inclusive)
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomArrayVal(arr) {
    return arr[randInt(0, arr.length-1)];
}
function generateLocations(num) {
    var loc = [];
    for(var i=0; i<num; i++) {
        loc.push(randomName.place());
    }
    return loc;
}
// pad() from: http://stackoverflow.com/a/10073788/3673087
function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

var data = [];

// Generate test users.
for(var i=0; i<argv['gen']; i++) {
    var gender_choice = randomArrayVal(UserValues.genders);
    var field_choice = randomArrayVal(UserValues.fields);
    var role_choice = randomArrayVal(UserValues.roles);
    var u = {
        "photoUrl": "http://theoldreader.com/kittens/200/200/?v="+randInt(0,999999999),
        "dateCreated": new Date(),
        "dateOfBirth": new Date(Date.UTC(randInt(1980,1998), randInt(0,11), randInt(1,27))),
        "gender": gender_choice,
        "showAge": randInt(0,1) === 0,
        "showGender": randInt(0,1) === 0,
        "email": "fake@fake",
        "name": randomName.first() + " " + randomName.last(),
        "token": "",
        "completedRegistration": true,
        "displayProfile": true,
        "googleId": randInt(0,99999999999999),
        "startDate": randInt(2017,2018)+"-"+pad(randInt(1,12), 2),
        "field": field_choice,
        "role": role_choice,
        "position": "Test Cat",
        "startLocation": randInt(UserValues.startLocationMin, UserValues.startLocationMax),
        "hasPlace": randInt(0,1) === 0,
        "factors": {
            "sameField": randInt(1,3),
            "sameAge": randInt(1,3),
            "sameGender": randInt(1,3),
            "substanceFree": randInt(1,3),
            "quietTime": randInt(1,3),
            "cleanliness": randInt(1,3)
        },
        "aboutMe": "I am a test user. I have no existence, but I really love to test things. I can test all sorts of things. You name it! I can test websites, apps, and servers.",
        "agree1": true
    };
    if(gender_choice === "other") {
        u["genderCustom"] = "non-binary";
    }
    if(field_choice === "other") {
        u["fieldCustom"] = "mystery";
    }
    if(role_choice === "other") {
        u["roleCustom"] = "part-time";
    }
    if(u["hasPlace"]) {
        var res_type_choice = randomArrayVal(UserValues.currentResTypes);
        u["currentResidence"] = {
            "location": randomName.place(),
            "residenceType": res_type_choice,
            "vacantRooms": randInt(1,5),
            "bathrooms": randInt(1,5),
            "durationInMonths": randInt(0,1) == 0 ? randInt(6,24) : -1,
            "commuteTimeInMins": randInt(20,60)
        };
        if(res_type_choice === "other") {
            u["currentResidence"]["residenceTypeCustom"] = "mobile";
        }
    } else {
        var roommatesMin = randInt(1,3);
        var roommatesMax = randInt(roommatesMin,6);
        u["preferences"] = {
            "locations": generateLocations(randInt(2,3)),
            "residenceType": randomArrayVal(UserValues.preferenceResTypes),
            "roommates": [roommatesMin, roommatesMax],
            "durationInMonths": randInt(0,1) == 0 ? randInt(6,24) : -1,
            "maxCommuteTimeInMins": randInt(20,60)
        };
        u["factors"]["location"] = randInt(1,3);
        u["factors"]["residenceType"] = randInt(1,3);
        u["factors"]["ownBedroom"] = randInt(1,3);
        u["factors"]["ownBathroom"] = randInt(1,3);
        u["factors"]["commuteTime"] = randInt(1,3);
    }
    data.push(u);
}

// console.log(data);

var config = {
    fields: data,
    db: argv['d'],
    collection: argv['c'],
    host: argv['h'],
    username: argv['u'],
    password: argv['p'],
    callback: (err, db) => {
        if(err)
            console.log(err);
    }
};

mi(config);