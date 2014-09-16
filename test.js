var tape = require('tape');
var config = require('getconfig');
var server = require('./server');

var test = tape.createHarness();

var output = test.createStream();
output.pipe(process.stdout);
output.on('end', function () {
    console.log('Tests complete, killing server.');
    process.exit(0);
});


var io = require('socket.io-client');

var socketURL = 'http://localhost:' + config.server.port;
var socketOptions = {
    transports: ['websocket'],
    'force new connection': true
};

test('tests noopd for now', function (t) {
    t.plan(1);
    t.ok(true);
});
