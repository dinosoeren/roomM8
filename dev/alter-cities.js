// Script to alter cities file to only contain ASCII names.
// City files obtained from http://download.geonames.org/export/dump/

const fs = require('fs');
const readline = require('readline');
var newFile = fs.createWriteStream('citynames.json', {
  // flags: 'a' // 'a' means appending (old data will be preserved)
});

var rd = readline.createInterface({
    input: fs.createReadStream('cities5000.txt'),
    output: process.stdout,
    terminal: false
});

var cities = [];

var info, cityName;
rd.on('line', function(line) {
    info = line.split('\t');
    cityName = info[2];
    if (!cities.includes(cityName))
        cities.push(cityName);
}).on('close', function() {
    newFile.write("[");
    for (cityName in cities)
        newFile.write('  "'+cities[cityName]+'",\n');
    newFile.write(']\n');
    newFile.end();
});