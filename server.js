/*global console*/
var https = require('https'),
    fs = require('fs'),
    request = require('request'),
    express = require('express'),
    stylus = require('stylus'),
    nib = require('nib'),
    yetify = require('yetify'),
    config = require('getconfig'),
    uuid = require('node-uuid'),
    crypto = require('crypto'),
    port = parseInt(process.env.PORT || config.server.port, 10),
    sio = require('socket.io');

var privateKey = fs.readFileSync(config.private_key).toString();
var certificate = fs.readFileSync(config.certificate).toString();

var app = express();
var server = https.createServer({key: privateKey, cert: certificate}, app);
var io;

var turnservers = config.turnservers || [];

function describeRoom(name) {
    var clients = io.sockets.clients(name);
    var result = {
        clients: {}
    };
    clients.forEach(function (client) {
        result.clients[client.id] = client.resources;
    });
    return result;
}

function safeCb(cb) {
    if (typeof cb === 'function') {
        return cb;
    } else {
        return function () {};
    }
}

var retryCount = 0;
function getServers() {
    request.post({url: "https://api.xirsys.com/getIceServers", form: config.api_creds, json: true}, function (error, response, body) {
        if (error || body.s != 200) {
            console.log("Unable to get TURN servers: " + error);
            if (retryCount < 11) {
                retryCount++;
                console.log("Attemping again, try: " + retryCount);
                getServers();
            }
            else {
                console.log("Giving up.");
            }
        }
        else {
            turnservers = [body.d.iceServers[1], body.d.iceServers[2]];
            io = sio.listen(server);
            server.listen(port);
            startItUp();
        }
    });
}
getServers();

function startItUp() {
    if (config.logLevel)
        io.set('log level', config.logLevel);

    io.sockets.on('connection', function (client) {
        console.log("io.sockets.on connection");
        client.resources = {
            screen: false,
            video: true,
            audio: false
        };

        // pass a message to another id
        client.on('message', function (details) {
            if (!details) return;

            var otherClient = io.sockets.sockets[details.to];
            if (!otherClient) return;

            details.from = client.id;
            otherClient.emit('message', details);
        });

        client.on('shareScreen', function () {
            client.resources.screen = true;
        });

        client.on('unshareScreen', function (type) {
            client.resources.screen = false;
            removeFeed('screen');
        });

        client.on('join', join);

        function removeFeed(type) {
            if (client.room) {
                io.sockets.in(client.room).emit('remove', {
                    id: client.id,
                    type: type
                });
                if (!type) {
                    client.leave(client.room);
                    client.room = undefined;
                }
            }
        }

        function join(name, cb) {
            // sanity check
            if (typeof name !== 'string') return;
            // leave any existing rooms
            removeFeed();
            safeCb(cb)(null, describeRoom(name));
            client.join(name);
            client.room = name;
        }

        // we don't want to pass "leave" directly because the
        // event type string of "socket end" gets passed too.
        client.on('disconnect', function () {
            removeFeed();
        });
        client.on('leave', function () {
            removeFeed();
        });

        client.on('create', function (name, cb) {
            if (arguments.length == 2) {
                cb = (typeof cb == 'function') ? cb : function () {};
                name = name || uuid();
            } else {
                cb = name;
                name = uuid();
            }
            // check if exists
            if (io.sockets.clients(name).length) {
                safeCb(cb)('taken');
            } else {
                join(name);
                safeCb(cb)(null, name);
            }
        });

        // tell client about stun and turn servers
        client.emit('stunservers', config.stunservers || []);
        client.emit('turnservers', turnservers);
    });
}

if (config.uid) process.setuid(config.uid);
console.log(yetify.logo() + ' -- signal master is running at: http://localhost:' + port);
