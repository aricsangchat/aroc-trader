const binance = require('node-binance-api');
const schedule = require('node-schedule');
const util = require('util');

let settings = [
  {
    state: null,
    settingName: 'Socket Trader',
    ticker: 'ETHUSDT',
    mainCurrency: 'USDT',
    secCurrency: 'ETH',
    mainInterval: 'sec',
    minSpread: 1,
    avgSpreadLimiter: 0.00000400,
    decimalPlace: 2,
    avlToStart: 6,
    avlMax: 2,
    cstRelistSell: -0.00000500,
    cstReSellLimit: -0.00000010,
    cstStopLossStart: -0.00001000,
    cstStopLossEnd: -0.00003000,
    cstMaxToCancelBuy: 0.01,
    LeftOverLimit: 15,
    SellLeftOverAt: 20,
    buyPad: 0.01,
    sellPad: 0.01,
    quantity: 0.30
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

  const j = schedule.scheduleJob(getMainInterval(settings[0].mainInterval), () => {
    binance.bookTickers((tickerData) => {
      binance.allOrders(settings[0].ticker, function(orders, symbol) {
        //console.log(symbol+' orders:', orders[orders.length - 1]);
        lastOrder = orders[orders.length - 1];
        if (lastOrder.status === 'NEW' && lastOrder.side === 'BUY') {
          const cst = tickerData[settings[0].ticker].bid - lastOrder.price;
          console.log(cst);
          if (cst > settings[0].cstMaxToCancelBuy) {
            binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
              console.log('Canceled order #: ', + lastOrder.orderId);
            });
          }
        } else if (lastOrder.status === 'PARTIALLY_FILLED' && lastOrder.side === 'BUY') {
          const cst = tickerData[settings[0].ticker].bid - lastOrder.price;
          console.log(cst);
          if (cst > settings[0].cstMaxToCancelBuy) {
            binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
              console.log('Canceled order #: ', + lastOrder.orderId);
            });
            settings[0].state = 'buy';
            console.log('Sell at: ', parseFloat(tickerData[settings[0].ticker].ask));
            placeSellOrder(parseFloat(tickerData[settings[0].ticker].ask), lastOrder.executedQty);
          }
        }
      });
    });
  });

  binance.websockets.trades([settings[0].ticker], function(trades) {
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
    if (buys.length >= 1 && sells.length >= 1) {
      const spread = getSpread(buys[buys.length - 1], sells[sells.length - 1]);
      const swing = getAverageQuantityWebsocket(buys)/getAverageQuantityWebsocket(sells) * 100;
      console.log('buys:', buys.length, 'sells:', sells.length);
      console.log('BQA:', getAverageQuantityWebsocket(buys));
      console.log('SQA:', getAverageQuantityWebsocket(sells));
      console.log('BPA:', getAveragePriceWebsocket(buys));
      console.log('SPA:', getAveragePriceWebsocket(sells));
      console.log('SPD:', spread);
      console.log('SWG:', Math.floor(swing) + '%');
      const swingSellLimit = 80;
      const swingBuyLimit = 50;
      //settings.state = null;
      if (swing < swingBuyLimit && (lastOrder.side === 'SELL' && lastOrder.status === 'FILLED') && (spread > settings[0].minSpread && (settings[0].state === 'buy' || settings[0].state === null))) {
        settings[0].state = 'sell';
        console.log('Buy at: ', parseFloat(buys[buys.length - 1].price));
        placeBuyOrder(parseFloat(buys[buys.length - 1].price));
      } else if (swing < swingBuyLimit && (lastOrder.side === 'BUY' && lastOrder.status === 'CANCELED') && (spread > settings[0].minSpread && (settings[0].state === 'buy' || settings[0].state === null))) {
        settings[0].state = 'sell';
        console.log('Buy at: ', parseFloat(buys[buys.length - 1].price));
        placeBuyOrder(parseFloat(buys[buys.length - 1].price));
      } else if (swing > swingSellLimit && (lastOrder.side === 'BUY' && lastOrder.status === 'FILLED') && (settings[0].state === 'sell' || settings[0].state === null)) {
        settings[0].state = 'buy';
        console.log('Sell at: ', parseFloat(sells[sells.length - 1]));
        placeSellOrder(parseFloat(sells[sells.length - 1].price));
      } else if (swing > swingSellLimit && (lastOrder.side === 'SELL' && lastOrder.status === 'CANCELED') && (settings[0].state === 'sell' || settings[0].state === null)) {
        settings[0].state = 'buy';
        console.log('Sell at: ', parseFloat(sells[sells.length - 1]));
        placeSellOrder(parseFloat(sells[sells.length - 1].price));
      } else {
        settings[0].state = null;
      }
    }
    if (buys.length == settings[0].avlMax) {
      buys.shift();
    }
    if (sells.length == settings[0].avlMax) {
      sells.shift();
    }
  });
};

function placeBuyOrder(price) {
  const buyPrice = parseFloat(price) + parseFloat(settings[0].buyPad);
  binance.options({
    'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
    'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
  });
  binance.buy(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), buyPrice.toFixed(settings[0].decimalPlace), {}, buyResponse => {
    console.log('Bought @:', buyPrice);
    console.log('Buy order id: ' + buyResponse);
    console.log(util.inspect(buyResponse, { showHidden: true, depth: null }));

    if (buyResponse.orderId === undefined) {
      settings[0].state = null;
    }
  });
}

function placeSellOrder(price, quantity) {
  const sellPrice = parseFloat(price) - parseFloat(settings[0].sellPad);
  binance.options({
    'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
    'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
  });
  const sellQty = quantity ? parseFloat(quantity) : settings[0].quantity.toFixed(settings[0].decimalPlace);
  binance.sell(settings[0].ticker, sellQty, sellPrice.toFixed(settings[0].decimalPlace), {}, sellResponse => {
    console.log('Sold @:', sellPrice);
    console.log('Sold order id: ' + sellResponse);
    console.log(util.inspect(sellResponse, { showHidden: true, depth: null }));

    if (sellResponse.orderId === undefined) {
      settings[0].state = null;
    }
  });
}

function getAveragePriceWebsocket(spreads) {
  let sum = 0;
  for( let i = 0; i < spreads.length; i++ ){
    sum += parseFloat(spreads[i].price); //don't forget to add the base
  }
  const avg = sum/spreads.length;
  return avg.toFixed(settings[0].decimalPlace);
}

function getAverageQuantityWebsocket(spreads) {
  let sum = 0;
  for( let i = 0; i < spreads.length; i++ ){
    sum += parseFloat(spreads[i].quantity); //don't forget to add the base
  }
  const avg = sum/spreads.length;
  return avg.toFixed(settings[0].decimalPlace);
}

function getSpread(buys, sells) {
  const profit =  sells.price - buys.price;
  return profit.toFixed(settings[0].decimalPlace);
}

function getAverageSpread(spreads) {
  let sum = 0;
  for( let i = 0; i < spreads.length; i++ ){
    sum += spreads[i]; //don't forget to add the base
  }
  const avg = sum/spreads.length;
  return avg.toFixed(settings[0].decimalPlace);
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
