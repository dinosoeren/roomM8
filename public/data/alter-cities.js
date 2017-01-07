// Script to alter cities file to only contain ASCII names.

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

newFile.write("[");
var count = 0, info, cityName;
rd.on('line', function(line) {
    // if(count > 20)
    //    return rd.close();
    info = line.split('\t');
    cityName = info[2];
    newFile.write('  "'+cityName+'",\n');
    // count++;
}).on('close', function() {
    newFile.write(']\n');
    newFile.end();
});