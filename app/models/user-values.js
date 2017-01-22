// Valid values for user inputs.
module.exports.genders = [
    "male",
    "female",
    "other"
];
module.exports.fields = [
    "cloud",
    "tech",
    "sales",
    "marketing",
    "design",
    "business",
    "finance",
    "legal",
    "people",
    "facilities",
    "other"
];
module.exports.roles = [
    "full-time",
    "resident",
    "intern",
    "other"
];
module.exports.preferenceResTypes = [
    "apartment",
    "house",
    "condo",
    "idc" // I don't care
];
module.exports.currentResTypes = [
    "apartment",
    "house",
    "condo",
    "other"
];
module.exports.factors = {
    noPlace: [
        "location",
        "residenceType",
        "ownBedroom",
        "ownBathroom",
        "commuteTime"
    ],
    hasPlace: [
        "cleanliness",
        "quietTime",
        "substanceFree",
        "sameGender",
        "sameAge",
        "sameField"
    ]
};
module.exports.factors.all = module.exports.factors.noPlace.concat(module.exports.factors.hasPlace);
module.exports.startLocationMin = 0;
module.exports.startLocationMax = 96;
module.exports.roommatesMin = 1;
module.exports.roommatesMax = 6;