const mongoose = require('mongoose');

/* Code adapted from: http://theholmesoffice.com/mongoose-connection-best-practice/ */

module.exports = function(auth) {

    // Use ES6 native promises
    mongoose.Promise = global.Promise;
    // Connect to MongoDB database.
    mongoose.connect(auth.mongoDB.URL);

    // When the connection is connected
    mongoose.connection.on('connected', function() {
        console.log('Mongoose default connection is open.');
    });

    // If the connection throws an error
    mongoose.connection.on('error', function(err) {
        console.error('Mongoose default connection error: ' + err);
    });

    // When the connection is disconnected
    mongoose.connection.on('disconnected', function() {
        console.log('Mongoose default connection disconnected.');
    });

    // If the Node process ends, close the Mongoose connection 
    process.on('SIGINT', function() {  
        mongoose.connection.close(function() { 
            console.log('Mongoose default connection disconnected through app termination.'); 
            process.exit(0);
        });
    });

};