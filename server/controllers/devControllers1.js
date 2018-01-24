const binance = require('node-binance-api');
const schedule = require('node-schedule');
const util = require('util');

let settings = [
  {
    state: null,
    settingName: 'Socket Trader',
    ticker: 'NEOETH',
    mainCurrency: 'ETH',
    secCurrency: 'NEO',
    mainInterval: 'sec',
    minSpread: 0.000150,
    avgSpreadLimiter: 0.00000400,
    decimalPlace: 6,
    avlToStart: 20,
    avlMax: 21,
    cstRelistSell: -0.05000000,
    cstReSellLimit: -0.00000010,
    cstStopLossStart: -0.00001000,
    cstStopLossEnd: -0.00003000,
    cstMaxToCancelBuy: 0.11,
    LeftOverLimit: 15,
    SellLeftOverAt: 20,
    buyPad: 0.000020,
    sellPad: 0.000020,
    quantity: 0.50,
    buyPing: [],
    buyPingActivate: 3,
    sag: [],
    ground: 0
  },
  {
    state: null,
    settingName: 'Socket Trader',
    ticker: 'BTCUSDT',
    mainCurrency: 'USDT',
    secCurrency: 'BTC',
    mainInterval: 'sec',
    minSpread: 9,
    avgSpreadLimiter: 0.00000400,
    decimalPlace: 2,
    avlToStart: 20,
    avlMax: 21,
    cstRelistSell: -0.05000000,
    cstReSellLimit: -0.00000010,
    cstStopLossStart: -0.00001000,
    cstStopLossEnd: -0.00003000,
    cstMaxToCancelBuy: 0.11,
    LeftOverLimit: 15,
    SellLeftOverAt: 20,
    buyPad: 3.00,
    sellPad: 3.00,
    quantity: 0.02,
    buyPing: [],
    buyPingActivate: 3,
    sag: [],
    ground: 0
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
  let cst = null;
  let tickerData = null;
  let lastOrderStatus = null;

  const j = schedule.scheduleJob(getMainInterval('0,15,30,45 * * * *'), () => {
    binance.allOrders(settings[0].ticker, function(orders, symbol) {
      lastOrder = orders[orders.length - 1];
      if (lastOrder.status === 'NEW' && lastOrder.side === 'BUY') {
        binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
          console.log('Canceled order #: ', + lastOrder.orderId);
        });
      }
    });
  });

  // function balance_update(data) {
  //   console.log('Balance Update');
  //   for ( let obj of data.B ) {
  //     let { a:asset, f:available, l:onOrder } = obj;
  //     if ( available == '0.00000000' ) continue;
  //     console.log(asset+'\tavailable: '+available+' ('+onOrder+' on order)');
  //   }
  // }
  // function execution_update(data) {
  //   let { x:executionType, s:symbol, p:price, q:quantity, S:side, o:orderType, i:orderId, X:orderStatus } = data;
  //   if ( executionType == 'NEW' ) {
  //     if ( orderStatus == 'REJECTED' ) {
  //       console.log('Order Failed! Reason: '+data.r);
  //     }
  //     console.log(symbol+' '+side+' '+orderType+' ORDER #'+orderId+' ('+orderStatus+')');
  //     if (symbol === settings[0].ticker) {
  //       lastOrderStatus = side;
  //     } else {
  //       lastOrderStatus = null;
  //     }
  //     console.log('..price: '+price+', quantity: '+quantity);
  //     return;
  //   }
  //   //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED
  //   console.log(symbol+'\t'+side+' '+executionType+' '+orderType+' ORDER #'+orderId);
  // }
  //binance.websockets.userData(balance_update, execution_update);

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
    if (sells.length >= settings[0].avlToStart) {
      const spread = getSpread(buys[buys.length - 1], sells[sells.length - 1]);
      const swing = getAverageQuantityWebsocket(buys)/getAverageQuantityWebsocket(sells) * 100;
      console.log('buys:', buys.length, 'sells:', sells.length);
      //console.log('BQA:', getAverageQuantityWebsocket(buys));
      console.log('SQA:', getAverageQuantityWebsocket(sells));
      //console.log('BPR:', buys);
      console.log('SPR:', sells);
      console.log(getPreviousSalePriceAverage(sells));
      console.log(getCurrentSalePriceAverage(sells));

      var p1 = {
        x: 0,
        y: sells[0].price
      };

      var p2 = {
        x: 20,
        y: sells[sells.length - 1].price
      };
      var currSag = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

      // settings[0].sag.push(currSag);
      //
      // let prevSag = settings[0].sag[0];
      // if (settings[0].sag.length === 4) {
      //   settings[0].sag.shift();
      // }
      console.log('CAG', currSag);
      //console.log('PAG', prevSag);
      // console.log('SPA:', getAveragePriceWebsocket(sells));
      console.log('SPD:', spread);
      settings[0].buySellPad = spread * 0.20;
      console.log('SWG:', Math.floor(swing) + '%');
      console.log('STE:', settings[0].state);
      console.log('BPR:', parseFloat(buys[buys.length - 1].price));
      console.log('SPR:', parseFloat(sells[sells.length - 1].price));
      console.log('LOS:', lastOrderStatus)
      if (currSag > 0 && spread > settings[0].minSpread) {
        if (settings[0].state === null && (swing > 70 && swing < 130)) {
          //if (lastOrderStatus === 'SELL') {
            placeBuyOrder(parseFloat(buys[buys.length - 1].price),sells[sells.length - 1].price);
          //}
        }
      }
      if (sells.length >= settings[0].avlMax) {
        sells.shift();
      }
      if (buys.length >= settings[0].avlMax) {
        buys.shift();
      }
    //   if (currSag <= 0 && settings[0].state === null) {
    //     settings[0].state = 'Grounded';
    //   }
    //   // if (settings[0].state === 'Grounded' && currSag >= prevSag) {
    //   //   settings[0].state = 'Bought';
    //   //   placeBuyOrder(parseFloat(buys[buys.length - 1].price));
    //   // } else
    //   if (settings[0].state === 'Grounded' && (currSag <= prevSag && prevSag <= 0)) {
    //     settings[0].state = 'Tracking';
    //   }
    //   // else if (settings[0].state === null && currSag < prevSag) {
    //   //   settings[0].state = 'Tracking';
    //   // }
    //   // if (settings[0].state === 'Tracking' && currSag <= prevSag) {
    //   //   settings[0].state = 'Tracking';
    //   // } else
    //   if (settings[0].state === 'Tracking' && (currSag >= prevSag && currSag >= 0)) {
    //     settings[0].state = 'Bought';
    //     //placeBuyOrder(parseFloat(buys[buys.length - 1].price));
    //     //settings[0].state = 'Bought';
    //   }
    //   // if (settings[0].state === 'Bought' && currSag >= prevSag) {
    //   //   settings[0].state = 'Bought';
    //   // } else
    //   if (settings[0].state === 'Bought' && currSag < prevSag) {
    //     //placeSellOrder(parseFloat(sells[sells.length - 1].price));
    //   }
    }
  });

  // const j = schedule.scheduleJob(getMainInterval(settings[0].mainInterval), () => {
  //   binance.bookTickers((tickerResponse) => {
  //     tickerData = tickerResponse;
  //     binance.allOrders(settings[0].ticker, function(orders, symbol) {
  //       lastOrder = orders[orders.length - 1];
  //
  //       //console.log(symbol+' orders:', orders[orders.length - 1]);
  //       // lastOrder = orders[orders.length - 1];
  //       // if (lastOrder.status === 'NEW' && lastOrder.side === 'BUY') {
  //       //   cst = tickerData[settings[0].ticker].bid - lastOrder.price;
  //       //   console.log(cst);
  //       //   if (cst > settings[0].cstMaxToCancelBuy) {
  //       //     // binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
  //       //     //   console.log('Canceled order #: ', + lastOrder.orderId);
  //       //     // });
  //       //   }
  //       // } else if (lastOrder.status === 'PARTIALLY_FILLED' && lastOrder.side === 'BUY') {
  //       //   cst = tickerData[settings[0].ticker].bid - lastOrder.price;
  //       //   console.log(cst);
  //       //   if (cst > settings[0].cstMaxToCancelBuy) {
  //       //     // binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
  //       //     //   console.log('Canceled order #: ', + lastOrder.orderId);
  //       //     // });
  //       //     settings[0].state = null;
  //       //     console.log('Sell at: ', parseFloat(tickerData[settings[0].ticker].ask));
  //       //     // placeSellOrder(parseFloat(tickerData[settings[0].ticker].ask), lastOrder.executedQty);
  //       //   }
  //       // } else
  //       if (lastOrder.status === 'FILLED' && (lastOrder.side === 'SELL' && settings[0].state === 'Bought')) {
  //         settings[0].state = null;
  //       }
  //       if (lastOrder.status === 'CANCELED' && (lastOrder.side === 'BUY' && settings[0].state === 'Bought')) {
  //         settings[0].state = null;
  //       }
  //     });
  //   });
  // });
};

function placeBuyOrder(price, sellPrice) {
  const buyPrice = parseFloat(price) + parseFloat(settings[0].buySellPad);
  binance.options({
    'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
    'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
  });
  binance.buy(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), buyPrice.toFixed(settings[0].decimalPlace), {}, buyResponse => {
    console.log('Bought @:', buyPrice);
    console.log('Buy order id: ' + buyResponse);
    //settings[0].state = 'Bought';
    console.log(util.inspect(buyResponse, { showHidden: true, depth: null }));
    placeSellOrder(parseFloat(sellPrice));

    // if (buyResponse.orderId === undefined) {
    //   settings[0].state = null;
    // } else {
    //   placeSellOrder(parseFloat(sellPrice));
    // }
  });
}

function placeSellOrder(price, quantity) {
  const sellPrice = parseFloat(price) - parseFloat(settings[0].buySellPad);
  binance.options({
    'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
    'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
  });
  binance.sell(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), sellPrice.toFixed(settings[0].decimalPlace), {}, sellResponse => {
    console.log('Sold @:', sellPrice);
    console.log('Sold order id: ' + sellResponse.orderId, sellResponse.code);
    console.log(util.inspect(sellResponse, { showHidden: true, depth: null }));
    settings[0].state = null;
    // if (sellResponse.orderId === undefined || sellResponse.code === -2010) {
    //   settings[0].state = null;
    // } else if (settings[0].state === 'Bought Failed') {
    //   settings[0].state = null;
    // } else {
    //   settings[0].state = null;
    // }
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

function getCurrentSalePriceAverage(array) {
  let sum = 0;
  for( let i = 0; i < 5; i++ ){
    sum += parseFloat(array[i].price);
  }
  const avg = sum/5;
  return avg.toFixed(settings[0].decimalPlace);
}

function getPreviousSalePriceAverage(array) {
  let sum = 0;
  for( let i = 0; i < 5; i++ ){
    sum += parseFloat(array[i + 15].price);
  }
  const avg = sum/5;
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
