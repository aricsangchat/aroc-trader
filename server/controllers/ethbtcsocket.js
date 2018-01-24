const binance = require('node-binance-api');
const schedule = require('node-schedule');
const util = require('util');
var _ = require('lodash');

let settings = [
  {
    state: null,
    settingName: 'Socket Trader',
    ticker: 'CNDETH',
    mainCurrency: 'ETH',
    secCurrency: 'CND',
    cancelBuyCron: '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
    minSpread: 0.00000050,
    maxSpread: 0.00010000,
    decimalPlace: 8,
    avlToStart: 20,
    avlMax: 21,
    buyPad: 0.000000,
    sellPad: 0.000000,
    quantity: 5
  }, {
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

  const j = schedule.scheduleJob(settings[0].cancelBuyCron, () => {
    binance.allOrders(settings[0].ticker, function(orders, symbol) {
      lastOrder = orders[orders.length - 1];
      if (lastOrder.status === 'NEW' && lastOrder.side === 'BUY') {
        binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
          console.log('Canceled order #: ', + lastOrder.orderId);
        });
      }
    });
  });

  const debounce = _.debounce(placeBuyOrder, 500, {leading: true, trailing: false});

  binance.websockets.trades([settings[0].ticker], function(trades) {
    let {e:eventType, E:eventTime, s:symbol, p:price, q:quantity, m:maker, a:tradeId} = trades;
    console.log(symbol+' trade update. price: '+price+', quantity: '+quantity+', maker: '+maker);
    if (maker) {
      buys.push({
        price: parseFloat(price),
        quantity: parseFloat(quantity)
      });
    } else {
      sells.push({
        price: parseFloat(price),
        quantity: parseFloat(quantity)
      });
    }
    if (sells.length >= settings[0].avlToStart) {
      const spread = getSpread(buys[buys.length - 1], sells[sells.length - 1]);
      //const swing = getAverageQuantityWebsocket(buys)/getAverageQuantityWebsocket(sells) * 100;
      console.log('buys:', buys.length, 'sells:', sells.length);
      //console.log('BQA:', getAverageQuantityWebsocket(buys));
      //console.log('SQA:', getAverageQuantityWebsocket(sells));
      //console.log('BPR:', buys);
      //console.log('SPR:', sells);
      // console.log(getPreviousSalePriceAverage(sells));
      // console.log(getCurrentSalePriceAverage(sells));

      // var p1 = {
      //   x: 0,
      //   y: sells[0].price
      // };
      //
      // var p2 = {
      //   x: 200,
      //   y: sells[sells.length - 1].price
      // };
      // var currSag = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

      // settings[0].sag.push(currSag);
      //
      // let prevSag = settings[0].sag[0];
      // if (settings[0].sag.length === 4) {
      //   settings[0].sag.shift();
      // }
      //console.log('CAG', currSag);
      //console.log('PAG', prevSag);
      // console.log('SPA:', getAveragePriceWebsocket(sells));
      console.log('SPD:', spread);
      settings[0].buySellPad = spread * 0.10;
      //console.log('SWG:', Math.floor(swing) + '%');
      //const realTimeSwing = parseFloat(buys[buys.length - 1].quantity)/parseFloat(sells[sells.length - 1].quantity) * 100;
      //console.log(parseFloat(buys[buys.length - 1].quantity));
      //console.log(parseFloat(sells[sells.length - 1].quantity));
      //console.log('RSG:', realTimeSwing);
      let buyPrice = parseFloat(buys[buys.length - 1].price);
      let sellPrice = parseFloat(sells[sells.length - 1].price);
      console.log('BPR:', buyPrice);
      console.log('SPR:', sellPrice);
      let averageBuyPrice = _.meanBy(buys, 'price');
      let averageSellPrice = _.meanBy(sells, 'price');
      console.log('ABP:', averageBuyPrice);
      console.log('ASP:', averageSellPrice);

      if (buyPrice <= averageBuyPrice && (spread >= settings[0].minSpread && spread <= settings[0].maxSpread)) {
        //if (swing > 0 && swing < 730) {
          debounce(buyPrice, sellPrice);
        //}
      }
      if (sells.length >= settings[0].avlMax) {
        sells.shift();
      }
      if (buys.length >= 500) {
        buys.shift();
      }
    }
  });

  function balance_update(data) {
    console.log('Balance Update');
    // for ( let obj of data.B ) {
    //   let { a:asset, f:available, l:onOrder } = obj;
    //   if ( available == '0.00000000' ) continue;
    //   console.log(asset+'\tavailable: '+available+' ('+onOrder+' on order)');
    // }
  }
  function execution_update(data) {
    let { x:executionType, s:symbol, p:price, q:quantity, S:side, o:orderType, i:orderId, X:orderStatus } = data;
    console.log(symbol+' '+side+' '+orderType+' ORDER #'+orderId+' ('+orderStatus+')' + executionType);
    // if ( executionType == 'NEW' ) {
    //   if ( orderStatus == 'REJECTED' ) {
    //     console.log('Order Failed! Reason: '+data.r);
    //   }
    //   console.log()
    //   console.log(symbol+' '+side+' '+orderType+' ORDER #'+orderId+' ('+orderStatus+')');
    //   if (symbol === settings[0].ticker) {
    //     lastOrderStatus = side;
    //   } else {
    //     lastOrderStatus = null;
    //   }
    //   console.log('..price: '+price+', quantity: '+quantity);
    //   return;
    // }
    //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED
    // console.log(symbol+'\t'+side+' '+executionType+' '+orderType+' ORDER #'+orderId);
  }
  binance.websockets.userData(balance_update, execution_update);

  // binance.websockets.depthCache([settings[0].ticker], (symbol, depth) => {
  //   let bids = binance.sortBids(depth.bids);
  //   let asks = binance.sortAsks(depth.asks);
  //   console.log(symbol+' depth cache update');
  //   // console.log('bids', bids);
  //   // console.log('asks', asks);
  //   console.log('best bid: '+binance.first(bids));
  //   console.log('best ask: '+binance.first(asks));
  // });
  // binance.websockets.depth([settings[0].ticker], (depth) => {
  //   let {e:eventType, E:eventTime, s:symbol, u:updateId, b:bidDepth, a:askDepth} = depth;
  //   console.log(symbol+' market depth update');
  //   console.log('bidDepth:', bidDepth[0]);
  //   console.log('askDepth:', askDepth[0]);
  // });
};

function placeBuyOrder(buyPrice, sellPrice) {
  const finalBuyPrice = parseFloat(buyPrice) + parseFloat(settings[0].buySellPad);
  binance.options({
    'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
    'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
  });
  binance.buy(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), finalBuyPrice.toFixed(settings[0].decimalPlace), {}, buyResponse => {
    console.log('Bought @:', finalBuyPrice);
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

// function count() {
//     array_elements = [];
//     const arr = [
//     ['1'],
//     ['1', '2'],
//     ['1','2','3'],
//     ['1','2','3','4'],
//     ['3'],
//     ['3','2'],
//     ['3','2','1']
//     ];
//
//     let up = [];
//     let down = [];
//
//     var previous = 0;
//     var cnt = 0;
//     for (var i = 0; i < arr.length; i++) {
//         if (arr[i][arr[i].length - 1] > previous) {
//             //if (cnt > 0) {
//                 document.write(previous + ' < ' + arr[i][arr[i].length - 1]  + ' times' + i + '<br>');
//                 array_elements.push('up');
//                 up.push('up');
//                 document.write(down.length + '<br>');
//                 down = [];
//            // }
//             previous = arr[i][arr[i].length - 1];
//             cnt++;
//         } else if (arr[i][arr[i].length - 1] < previous) {
//         document.write(previous + ' > ' + arr[i][arr[i].length - 1]  + ' times' + i + '<br>');
//         array_elements.push('down')
//         down.push('down');
//         document.write(up.length + '<br>');
//         up = [];
//         }
//     }
//
//         array_elements.sort();
//         var current = null;
//     var cnt = 0;
//     for (var i = 0; i < array_elements.length; i++) {
//         if (array_elements[i] != current) {
//             if (cnt > 0) {
//                 document.write(current + ' comes --> ' + cnt + ' times<br>');
//             }
//             current = array_elements[i];
//             cnt = 1;
//         } else {
//             cnt++;
//         }
//     }
//     if (cnt > 0) {
//         document.write(current + ' comes --> ' + cnt + ' times');
//     }
//
//
// }
