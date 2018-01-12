import express from 'express';
import WebpackDevServer from 'webpack-dev-server';
import webpack from 'webpack';

const app = express();
// const port = 3000;
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const devControllers = require('./controllers/devControllers');
const workerOne = require('./controllers/workerOne');
const workerTwo = require('./controllers/workerTwo');
const workerThree = require('./controllers/workerThree');
const workerFour = require('./controllers/workerFour');
const workerFive = require('./controllers/workerFive');
const joeBillXrp = require('./controllers/joeBillXrp');
const garyBillXrp = require('./controllers/garyBillXrp');
const ethusdt = require('./controllers/ETHUSDT');
const vibeeth = require('./controllers/VIBEETH');
const joeBillVibeEth = require('./controllers/joeBillVibeEth');
const btcusdt = require('./controllers/btcusdt');

const cors = require('cors');

app.use(cors());

io.sockets.on('connection', onSocketConnect);

function onSocketConnect(socket) {
  console.log('Socket.io Client Connected');

  socket.on('disconnect', function(){
    console.log('Socket.io Client Disconnected');
  });
}

if (process.env.NODE_ENV == 'dev') {
  server.listen(3000, devControllers.preCheck, devControllers.startProgram);
}
else if (process.env.NODE_ENV == 'workerOne') {
  server.listen(3001, workerOne.startProgram);
}
else if (process.env.NODE_ENV == 'workerTwo') {
  server.listen(3002, workerTwo.startProgram);
}
else if (process.env.NODE_ENV == 'workerThree') {
  server.listen(3003, workerThree.startProgram);
}
else if (process.env.NODE_ENV == 'workerFour') {
  server.listen(3004, workerFour.startProgram);
}
else if (process.env.NODE_ENV == 'workerFive') {
  server.listen(3005, workerFive.startProgram);
}
else if (process.env.NODE_ENV == 'joeBillXrp') {
  server.listen(3006, joeBillXrp.startProgram);
}
else if (process.env.NODE_ENV == 'garyBillXrp') {
  server.listen(3007, garyBillXrp.startProgram);
}
else if (process.env.NODE_ENV == 'ethusdt') {
  server.listen(3008, ethusdt.startProgram);
}
else if (process.env.NODE_ENV == 'vibeeth') {
  server.listen(3009, vibeeth.startProgram);
}
else if (process.env.NODE_ENV == 'joeBillVibeEth') {
  server.listen(3010, joeBillVibeEth.startProgram);
}
else if (process.env.NODE_ENV == 'btcusdt') {
  server.listen(3011, btcusdt.startProgram);
}
