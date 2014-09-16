#jc4p/signalmaster

A fork of signalmaster which supports:

1. `wss` aka runs on SSL
2. Getting TURN servers dynamically on start-up using Xirsys's API.


##Usage

1. `cp dev_config.json prod_config.json`
2. Add in your certificate info and Xirsys info.
3. `NODE_ENV=prod node server.js`
