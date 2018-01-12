const binance = require('node-binance-api');
const schedule = require('node-schedule');

const mainInterval = 'sec';
const minSpread = 0.00000400;
const avgSpreadLimiter = 0.00000400;

const decimalPlace = 8;
const avlToStart = 100;
const avlMax = 20;

const mainCurrency = 'USDT';
const currency = 'BTCUSDT';
const secCurrency = 'BTC';

const cstRelistSell = -0.00000500;
const cstStopLossStart = -0.00001000;
const cstStopLossEnd = -0.00003000;
const cstMaxToCancelBuy = 0.00000003;
const cstReSellLimit = 0.00000003;

const LeftOverLimit = 20;
const buyPad = 0.00000011;
const sellPad = 0.00000011;

let quantity = 0;
let spread = null;
let avgerageSpread = [];
let allOpenOrders = [];
let spd = null;
let tickerInfo = null;
let secCurrencyBalance = null;
let avs = null;
let settings = [
  {
    state: null,
    settingName: 'Socket Trader',
    ticker: 'BTCUSDT',
    mainCurrency: 'USDT',
    secCurrency: 'BTC',
    mainInterval: '5s',
    minSpread: 10,
    avgSpreadLimiter: 0.00000400,
    decimalPlace: 8,
    avlToStart: 6,
    avlMax: 7,
    cstRelistSell: -0.00000500,
    cstReSellLimit: -0.00000010,
    cstStopLossStart: -0.00001000,
    cstStopLossEnd: -0.00003000,
    cstMaxToCancelBuy: 0.00000005,
    LeftOverLimit: 15,
    SellLeftOverAt: 20,
    buyPad: 0.00000011,
    sellPad: 0.00000011,
    quantity: 50
  }
];

exports.startProgram = () => {
  binance.options({
    'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
    'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
  });
  let sells = [];
  let buys = [];
  let spdAvg = [];
  let lastOrder = {};
  let sellsTransactionArray = [];
  let buysTransationArray = [];

  const j = schedule.scheduleJob(getMainInterval(mainInterval), () => {
    binance.allOrders('BTCUSDT', function(orders, symbol) {
      console.log(symbol+' orders:', orders[orders.length - 1]);
      lastOrder = orders[orders.length - 1];
    });
  });

  binance.websockets.trades([currency], function(trades) {
    let {e:eventType, E:eventTime, s:symbol, p:price, q:quantity, m:maker, a:tradeId} = trades;
    console.log(symbol+' trade update. price: '+price+', quantity: '+quantity+', maker: '+maker);
    if (maker) {
      buys.push({
        price: price,
        quantity: quantity
      });
    } else {
      sells.push({
        price: price,
        quantity: quantity
      });
    }
    if (buys.length > 1 && sells.length > 1) {
      const spread = getSpread(buys[buys.length - 1], sells[sells.length - 1]);
      const swing = getAverageQuantityWebsocket(buys)/getAverageQuantityWebsocket(sells) * 100;
      console.log('buys:', buys.length, 'sells:', sells.length);
      console.log('BQA:', getAverageQuantityWebsocket(buys));
      console.log('SQA:', getAverageQuantityWebsocket(sells));
      console.log('BPA:', getAveragePriceWebsocket(buys));
      console.log('SPA:', getAveragePriceWebsocket(sells));
      console.log('SPD:', spread);
      console.log('SWG:', Math.floor(swing) + '%');
      const quantity = 0.09;
      const swingSellLimit = 130;
      const swingBuyLimit = 50;
      settings.state = null;
      if (swing < swingBuyLimit && (lastOrder.side === 'SELL' && lastOrder.status === 'FILLED')) {
        if (spread > settings.minSpread && (settings.state === 'buy' || settings.state === null)) {
          settings.state = 'sell';
          console.log('Buy at: ', buys[buys.length - 1]);
        }
      } else if (swing < swingBuyLimit && (lastOrder.side === 'BUY' && lastOrder.status === 'CANCELED')) {
        if (spread > settings.minSpread && (settings.state === 'buy' || settings.state === null)) {
          settings.state = 'sell';
          console.log('Buy at: ', buys[buys.length - 1]);
        }
      } else if (swing > swingSellLimit && (lastOrder.side === 'BUY' && lastOrder.status === 'FILLED')) {
        settings.state = 'buy';
        console.log('Sell at: ', sells[sells.length - 1]);
      }
    }
    if (buys.length == avlMax) {
      buys.shift();
    }
    if (sells.length == avlMax) {
      sells.shift();
    }
  });
};

function getAveragePriceWebsocket(spreads) {
  let sum = 0;
  for( let i = 0; i < spreads.length; i++ ){
    sum += parseFloat(spreads[i].price); //don't forget to add the base
  }
  const avg = sum/spreads.length;
  return avg.toFixed(decimalPlace);
}

function getAverageQuantityWebsocket(spreads) {
  let sum = 0;
  for( let i = 0; i < spreads.length; i++ ){
    sum += parseFloat(spreads[i].quantity); //don't forget to add the base
  }
  const avg = sum/spreads.length;
  return avg.toFixed(decimalPlace);
}

function getSpread(buys, sells) {
  const profit =  sells.price - buys.price;
  return profit.toFixed(decimalPlace);
}

function getAverageSpread(spreads) {
  let sum = 0;
  for( let i = 0; i < spreads.length; i++ ){
    sum += spreads[i]; //don't forget to add the base
  }
  const avg = sum/spreads.length;
  return avg.toFixed(decimalPlace);
}


function calculateMargin(openPrice, currentPrice) {
  const profit = currentPrice - openPrice;
  return profit.toFixed(decimalPlace);
}

function calculateSpread(openPrice, currentPrice) {
  const profit = currentPrice - openPrice;
  return profit.toFixed(decimalPlace);
}

function relistSell(cst, orderPrice) {
  const sellPrice = parseFloat(orderPrice) - parseFloat(cst) * -1 - parseFloat(sellPad);

  if (cst >= cstRelistSell && cst != 0.00000000) {
    binance.cancelOrders(currency, function(response, symbol) {
      binance.sell(currency, quantity, sellPrice.toFixed(decimalPlace), {}, marketSellResponse => {
        console.log('Sold @: ', sellPrice );
        console.log('Sell order id: ' + marketSellResponse.orderId);
        console.log('******************************');
      });
    });
  } else if (cst <= cstStopLossStart && cst >= cstStopLossEnd) {
    if (cst != 0.00000000) {
      binance.cancelOrders(currency, function(response, symbol) {
        binance.sell(currency, quantity, sellPrice.toFixed(decimalPlace), {}, marketSellResponse => {
          console.log('Sold @: ', sellPrice );
          console.log('Sell order id: ' + marketSellResponse.orderId);
          console.log('******************************');
        });
      });
    }
  }
  else {
    console.log('Waiting for Quick Sell/Stop Loss.');
    console.log('******************************');
  }
}

function makeBuyOrder(bid, spd) {
  const buyPrice = parseFloat(bid) + parseFloat(buyPad),
    sellPrice = parseFloat(bid) + parseFloat(spd) - parseFloat(sellPad);

  binance.buy(currency, quantity, buyPrice, {}, buyResponse => {
    console.log('Bought @:', buyPrice.toFixed(decimalPlace));
    console.log('Buy order id: ' + buyResponse.orderId);
    //console.log('******************************');
    const t = schedule.scheduleJob('* * * * * *', () => {
      binance.openOrders(currency, (openOrders, symbol) => {
        if (openOrders.length == 0) {
          binance.sell(currency, quantity, sellPrice.toFixed(decimalPlace), {}, sellResponse => {
            console.log('Sold @:', sellPrice.toFixed(decimalPlace));
            console.log('Sell order id: ' + sellResponse.orderId);
            makeStopLossSell();
            t.cancel();
          });
        } else {
          console.log('Buy Status: Open');
        }
      });
    });
  });
}

function makeStopLossSell() {
  const t = schedule.scheduleJob('* * * * * *', () => {
    binance.bookTickers((ticker) => {
      binance.openOrders(currency, (openOrders, symbol) => {
        if (openOrders.length == 0) { t.cancel(); }
        openOrders.forEach(openOrder => {

          if (openOrder.side == 'SELL') {
            if (calculateMargin(openOrder.price, ticker[currency].ask) <= cstStopLossStart && calculateMargin(openOrder.price, ticker[currency].ask) >= cstStopLossEnd) {
              binance.cancel(currency, openOrder.orderId, function(response, symbol) {
                console.log('Canceled order #: ', + openOrder.orderId);
                binance.sell(currency, quantity, ticker[currency].ask, {}, sellResponse => {
                  console.log('Sold @:', ticker[currency].ask);
                  console.log('Sell order id: ' + sellResponse.orderId);
                  console.log('******************************');
                });
              });
            } else {
              console.log('Sell Status: Open');
              console.log('CST', openOrder.side, 'at', calculateMargin(openOrder.price, ticker[currency].ask));
            }
          } else {
            t.cancel();
          }

        });
      });
    });
  });
}

function getMainInterval(int) {
  switch (int) {
    case 'sec':
      return '* * * * * *';
    case '5s':
      return '0,5,10,15,20,30,35,40,45,50,55 * * * * *';
    case '10s':
      return '0,10,20,30,45 * * * * *';
    case '15s':
      return '0,15,30,45 * * * * *';
    case '30s':
      return '0,30 * * * * *';
    default:
      return '0,30 * * * * *';
  }
}

function getQuantity(stockName) {
  switch (stockName) {
    case 'ADXETH':
      return 10;
    case 'CMTETH':
      return 20;
    case 'BCPETH':
      return 15;
    case 'BNBETH':
      return 2;
    case 'ICXETH':
      return 2;
    default:
      return 0;
  }
}

function sellLeftover() {
  let leftOverBalance = null;
  const t = schedule.scheduleJob('* * * * * *', () => {
    binance.balance(balances => {
      leftOverBalance = balances[secCurrency].available;
      binance.bookTickers((ticker) => {
        binance.openOrders(currency, (openOrders, symbol) => {
          if (leftOverBalance > LeftOverLimit && openOrders.length == 0) {
            const sellPrice = parseFloat(ticker[currency].ask) - parseFloat(sellPad);
            binance.sell(currency, Math.floor(leftOverBalance), sellPrice, {}, leftOverSellResponse => {
              console.log('Left over qty:', leftOverBalance);
              console.log('Sold Left Over @: ', ticker[currency].ask );
              console.log('Sell order id: ' + leftOverSellResponse.orderId);
              console.log('******************************');
            });

          } else { t.cancel(); }
        });
      });
    });
  });
}
