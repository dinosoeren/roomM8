// Script to generate random test users and insert them into mongo database.

const fs = require('fs');
const mi = require('mongoimport');
const randomName = require('random-name');
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

var fields = [
    "cloud",
    "tech",
    "sales",
    "marketing",
    "design",
    "business",
    "finance",
    "legal",
    "people",
    "facilities"
];
var roles = [
    "full-time",
    "resident",
    "intern"
];
var resTypesPref = [
    "apartment",
    "house",
    "condo",
    "idc"
];
var resTypes = [
    "apartment",
    "house",
    "condo"
];

var data = [];

// Generate test users.
for(var i=0; i<argv['gen']; i++) {
    var u = {
        "photoUrl": "http://lorempixel.com/300/300/cats/?v="+randInt(0,999999999),
        "gender": randInt(0,1) == 0 ? "male" : "female",
        "email": "fake@fake",
        "name": randomName.first() + " " + randomName.last(),
        "token": "",
        "googleId": randInt(0,99999999999999),
        "startDate": "2017-"+pad(randInt(1,12), 2),
        "age": randInt(18,95),
        "field": randomArrayVal(fields),
        "role": randomArrayVal(roles),
        "position": "Test Monkey",
        "startLocation": randInt(0,96),
        "hasPlace": randInt(0,1) == 0,
        "factors": {
            "sameField": randInt(0,3),
            "sameAge": randInt(0,3),
            "sameGender": randInt(0,3),
            "substanceFree": randInt(0,3),
            "quietTime": randInt(0,3),
            "cleanliness": randInt(0,3)
        },
        "aboutMe": "I am a test user. I have no existence, but I really love to test things. I can test all sorts of things. You name it! I can test websites, apps, and servers."
    };
    if(u["hasPlace"]) {
        u["currentResidence"] = {
            "location": randomName.place(),
            "residenceType": randomArrayVal(resTypes),
            "vacantRooms": randInt(1,5),
            "bathrooms": randInt(1,5),
            "durationInMonths": randInt(0,1) == 0 ? randInt(6,24) : -1,
            "commuteTimeInMins": randInt(20,60)
        };
    } else {
        u["preferences"] = {
            "locations": generateLocations(randInt(2,3)),
            "residenceType": randomArrayVal(resTypesPref),
            "roommates": randInt(1,5),
            "durationInMonths": randInt(0,1) == 0 ? randInt(6,24) : -1,
            "maxCommuteTimeInMins": randInt(20,60)
        };
        u["factors"]["location"] = randInt(0,3);
        u["factors"]["residenceType"] = randInt(0,3);
        u["factors"]["ownBedroom"] = randInt(0,3);
        u["factors"]["ownBathroom"] = randInt(0,3);
        u["factors"]["commuteTime"] = randInt(0,3);
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