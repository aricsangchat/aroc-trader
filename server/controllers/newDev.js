const binance = require('node-binance-api');
const schedule = require('node-schedule');
const util = require('util');
const _ = require('lodash');
const moment = require('moment');
const json2csv = require('json2csv');
const fs = require('fs');
const brain = require('brain.js');

const fields = ['close', 'time', 'ema7', 'ema25', 'ema99', 'ema150'];

binance.options({
  'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
  'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV',
  'test': false
});

let settings = [
  {
    settingName: 'Socket Trader',
    ticker: 'ETHUSDT',
    mainCurrency: 'ETH',
    secCurrency: 'USDT',
    cancelBuyCron: '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
    minSpread: 1.00,
    spreadProfit: 2.30,
    decimalPlace: 2,
    avlToStart: 5,
    avlMax: 21,
    buyPad: 0.000000,
    sellPad: 0.000000,
    quantity: 0.30,
    buyPrice: null,
    buyOrderNum: null,
    sellOrderNum: null,
    sellPrice: null,
    state: null,
    bst: null,
    sst: null,
    bstLimit: 0.01,
    sstLimit: -0.01,
    sstLimitEnable: false,
    buySellPad: 0,
    buySellPadPercent: 0,
    time: 2,
    startingAverage: null
  },{
    settingName: 'Socket Trader',
    ticker: 'TRXETH',
    mainCurrency: 'ETH',
    secCurrency: 'TRX',
    cancelBuyCron: '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
    minSpread: 0.00000002,
    maxSpread: 10.00, // not in use
    decimalPlace: 8,
    avlToStart: 10,
    avlMax: 21,
    buyPad: 0.000000,
    sellPad: 0.000000,
    quantity: 2500,
    buyPrice: null,
    buyOrderNum: null,
    sellOrderNum: null,
    sellPrice: null,
    state: null,
    bst: null,
    sst: null,
    bstLimit: 0.00000005,
    sstLimit: -0.00000005,
    sstLimitEnable: true,
    buySellPad: 0,
    buySellPadPercent: 0
  }
];

exports.startProgram = () => {
  let sells = [];
  let buys = [];
  let spdAvg = [];
  let lastOrder = {};
  let sellsTransactionArray = [];
  let buysTransationArray = [];
  let cst = null;
  let tickerData = null;
  let lastOrderStatus = null;
  let currentSellPrice = null;
  let spread = null;
  let startingAverageArray = [];
  let movingAverageArray = [];
  // const j = schedule.scheduleJob(settings[0].cancelBuyCron, () => {
  //   binance.allOrders(settings[0].ticker, function(orders, symbol) {
  //     lastOrder = orders[orders.length - 1];
  //     if (lastOrder.status === 'NEW' && lastOrder.side === 'BUY') {
  //       // binance.cancel(settings[0].ticker, lastOrder.orderId, function(response, symbol) {
  //       //   console.log('Canceled order #: ', + lastOrder.orderId);
  //       // });
  //     }
  //   });
  // });

  const debounceBuy = _.debounce(placeBuyOrder, 700, {leading: true, trailing: false});
  const debounceSell = _.debounce(placeSellOrder, 700, {leading: true, trailing: false});
  const debounceCancelBuy = _.debounce(cancelBuy, 700, {leading: true, trailing: false});
  const debounceCancelSell = _.debounce(cancelSell, 700, {leading: true, trailing: false});
  let networkArray = [];

  // Periods: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
  binance.websockets.candlesticks([settings[0].ticker], '1m', (candlesticks) => {
    let { e:eventType, E:eventTime, s:symbol, k:ticks } = candlesticks;
    let { o:open, h:high, l:low, c:close, v:volume, n:trades, i:interval, x:isFinal, q:quoteVolume, V:buyVolume, Q:quoteBuyVolume } = ticks;
    console.log(symbol+' '+interval+' candlestick update');
    //console.log('open: '+open);
    //console.log('high: '+high);
    //console.log('low: '+low);

    console.log('close: '+close);
    //console.log('volume: '+volume);
    //console.log('isFinal: '+isFinal);
    if (startingAverageArray.length < 1) {
      startingAverageArray.push({
        'close': parseFloat(parseFloat(close).toFixed(settings[0].decimalPlace)),
        time: Date.now()
      });
      settings[0].startingAverage = _.meanBy(startingAverageArray, 'close');
    } else {
      movingAverageArray.push({
        'close': parseFloat(parseFloat(close).toFixed(settings[0].decimalPlace)),
        'time': Date.now(),
        'ema7': calculateMovingAverage1(close,movingAverageArray, 7),
        'ema25': calculateMovingAverage2(close,movingAverageArray, 25),
        'ema99': calculateMovingAverage3(close,movingAverageArray, 99),
        'ema150': calculateMovingAverage4(close,movingAverageArray, 150),
      });
    }
    //console.log(startingAverageArray);
    //console.log('MAG:',movingAverageArray);
    // console.log('SAVG:', settings[0].startingAverage);
    console.log('STE:',settings[0].state);
    let mostRecentClose = movingAverageArray[movingAverageArray.length - 1].close;
    let mostRecentEMA7 = movingAverageArray[movingAverageArray.length - 1].ema7;
    let mostRecentEMA25 = movingAverageArray[movingAverageArray.length - 1].ema25;
    let mostRecentEM99 = movingAverageArray[movingAverageArray.length - 1].ema99;
    // networkArray.push({
    //   input: {
    //     c: mostRecentClose,
    //     e: mostRecentEMA7,
    //     d: mostRecentEMA25,
    //     b: mostRecentEM99,
    //   },
    //   output: {
    //     wait: 1
    //   }
    // });

    // let output = net.run(networkArray[networkArray.length - 1].input);
    // console.log('Output',output);
    //console.log('net:', networkArray);
    // console.log(mostRecentClose, mostRecentEMA7.toFixed(settings[0].decimalPlace), mostRecentEMA25.toFixed(settings[0].decimalPlace), mostRecentEM99.toFixed(settings[0].decimalPlace));
    //let profit = parseFloat(settings[0].buyPrice) + 1.20;
    if (settings[0].state === null && (mostRecentEMA7 >= mostRecentEMA25 && (mostRecentEMA25 >= mostRecentEM99 && close <= mostRecentEMA7))) {
      debounceBuy(close);
    } else if (settings[0].state === 'Bought Filled' && (mostRecentEMA7 <= mostRecentEMA25 && (mostRecentEMA25 <= mostRecentEM99 && close >= mostRecentEMA7))) {
      debounceSell(close);
      settings[0].sstLimitEnable = false;
    } else if (settings[0].state === 'Bought Filled' && (mostRecentEMA7 <= mostRecentEMA25 && (mostRecentEMA25 <= mostRecentEM99 && close >= mostRecentEMA7))) {
      debounceSell(close);
      settings[0].sstLimitEnable = false;
    }

    // if (movingAverageArray.length > 23) {
    //   movingAverageArray.shift();
    // }

    if (movingAverageArray.length === 500) {
      // var json = JSON.stringify(networkArray);
      // fs.writeFile('myjsonfile.json', json, 'utf8', function(err) {
      //   if (err) throw err;
      //   console.log('file saved');
      // });

      var opts = {
        data: movingAverageArray,
        fields: fields,
        quotes: ''
      };
      const csv = json2csv(opts);
      fs.writeFile('file.csv', csv, function(err) {
        if (err) throw err;
        console.log('file saved');
      });
    }
  });

  binance.websockets.trades([settings[0].ticker], function(trades) {
    let {e:eventType, E:eventTime, s:symbol, p:price, q:quantity, m:maker, a:tradeId} = trades;
    //console.log(symbol+' trade update. price: '+price+', quantity: '+quantity+', maker: '+maker);
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
    if (buys.length >= settings[0].avlToStart) {
      spread = getSpread(buys[buys.length - 1], sells[sells.length - 1]);
      let averageBuyPrice = _.meanBy(buys, 'price');
      let averageSellPrice = _.meanBy(sells, 'price');
      let minBuyPrice = _.minBy(buys, 'price');
      // let averageSellPrice = _.meanBy(sells, 'price');
      let buyPrice = parseFloat(buys[buys.length - 1].price);
      currentSellPrice = parseFloat(sells[sells.length - 1].price);
      settings[0].bst = buyPrice - settings[0].buyPrice;
      settings[0].sst = currentSellPrice - settings[0].sellPrice;
      settings[0].buySellPad = spread * settings[0].buySellPadPercent;
      // console.log('buys:', buys.length, 'sells:', sells.length);
      // console.log('SPD:', spread);
      // console.log('BPR:', buyPrice);
      // console.log('SPR:', currentSellPrice.toFixed(settings[0].decimalPlace));
      // console.log('ABP:', averageBuyPrice.toFixed(settings[0].decimalPlace));
      // console.log('ASP:', averageSellPrice.toFixed(settings[0].decimalPlace));
      console.log('BST:', buyPrice - settings[0].buyPrice);
      // console.log('BON:', settings[0].buyOrderNum);
      // console.log('SST:', currentSellPrice - settings[0].sellPrice);
      // console.log('SON:', settings[0].sellOrderNum);
      // console.log('STE:', settings[0].state);
      // console.log('MBP:', minBuyPrice.price);

      if (buyPrice <= minBuyPrice.price && (spread >= settings[0].minSpread && settings[0].state === null)) {
      // if (spread >= settings[0].minSpread && settings[0].state === null) {
        //debounceBuy(buyPrice);
      } else if (settings[0].state === 'RelistSell' && settings[0].sstLimitEnable === true) {
        //debounceSell(currentSellPrice.toFixed(settings[0].decimalPlace));
      } else if (settings[0].bst >= settings[0].bstLimit && (settings[0].buyOrderNum !== null && settings[0].state !== 'buyPartialFill')) {
        debounceCancelBuy(settings[0].buyOrderNum);
      } else if (settings[0].sst <= settings[0].sstLimit && (settings[0].sellOrderNum !== null && (settings[0].state !== 'sellPartialFill' && settings[0].sstLimitEnable === true))) {
        debounceCancelSell(settings[0].sellOrderNum);
      }
      if (sells.length >= settings[0].avlMax) {
        sells.shift();
      }
      if (buys.length >= 1000) {
        buys.shift();
      }

      //const swing = getAverageQuantityWebsocket(buys)/getAverageQuantityWebsocket(sells) * 100;
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
      //console.log('SWG:', Math.floor(swing) + '%');
      //const realTimeSwing = parseFloat(buys[buys.length - 1].quantity)/parseFloat(sells[sells.length - 1].quantity) * 100;
      //console.log(parseFloat(buys[buys.length - 1].quantity));
      //console.log(parseFloat(sells[sells.length - 1].quantity));
      //console.log('RSG:', realTimeSwing);
    }
  });

  // The only time the user data (account balances) and order execution websockets will fire, is if you create or cancel an order, or an order gets filled or partially filled
  function balance_update(data) {
    // console.log('Balance Update');
    // for ( let obj of data.B ) {
    //   let { a:asset, f:available, l:onOrder } = obj;
    //   if ( available == '0.00000000' ) continue;
    //   console.log(asset+'\tavailable: '+available+' ('+onOrder+' on order)');
    // }
  }
  function execution_update(data) {
    let { x:executionType, s:symbol, p:price, q:quantity, S:side, o:orderType, i:orderId, X:orderStatus } = data;
    if (symbol === settings[0].ticker) {
      if ( executionType == 'NEW' ) {
        if ( orderStatus == 'REJECTED' ) {
          console.log('Order Failed! Reason: '+data.r);
          return;
        }
      }
      //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED
      console.log(symbol+'\t'+side+' '+executionType+' '+orderType+' ORDER #'+orderId);
      console.log(symbol+' '+side+' '+orderType+' ORDER #'+orderId+' ('+orderStatus+')');
      console.log('..price: '+price+', quantity: '+quantity);

      if (side === 'BUY' && orderStatus === 'FILLED') {
        settings[0].state = 'Bought Filled';
        settings[0].buyOrderNum = null;
        return;
      } else if (side === 'SELL' && orderStatus === 'FILLED') {
        settings[0].state = null;
        settings[0].sellPrice = null;
        settings[0].sellOrderNum = null;
        settings[0].buyPrice = null;
        settings[0].buyOrderNum = null;
        return;
      } else if (side === 'BUY' && orderStatus === 'NEW') {
        settings[0].state = 'Bought';
        settings[0].buyPrice = price;
        settings[0].buyOrderNum = orderId;
        return;
      } else if (side === 'SELL' && orderStatus === 'NEW') {
        settings[0].state = 'Selling';
        settings[0].sellPrice = price;
        settings[0].sellOrderNum = orderId;
        return;
      } else if (side === 'BUY' && orderStatus === 'PARTIALLY_FILLED') {
        settings[0].state = 'buyPartialFill';
        return;
      } else if (side === 'SELL' && orderStatus === 'PARTIALLY_FILLED') {
        settings[0].state = 'sellPartialFill';
        return;
      } else if (side === 'SELL' && orderStatus === 'CANCELED') {
        settings[0].state = 'Bought Filled';
        settings[0].sellPrice = null;
        settings[0].sellOrderNum = null;
        return;
      } else if (side === 'BUY' && orderStatus === 'CANCELED') {
        settings[0].state = null;
        settings[0].buyPrice = null;
        settings[0].buyOrderNum = null;
        return;
      } else {
        return;
      }
    }
  }
  binance.websockets.userData(balance_update, execution_update);
};

function calculateMovingAverage1(price,prevEMA,time) {
  if (prevEMA.length === 0) {
    return price * 2/(time+1) + settings[0].startingAverage * (1-2/(time+1));
  } else {
    return price * 2/(time+1) + prevEMA[prevEMA.length - 1].ema7 * (1-2/(time+1));
  }
}
function calculateMovingAverage2(price,prevEMA,time) {
  if (prevEMA.length === 0) {
    return price * 2/(time+1) + settings[0].startingAverage * (1-2/(time+1));
  } else {
    return price * 2/(time+1) + prevEMA[prevEMA.length - 1].ema25 * (1-2/(time+1));
  }
}
function calculateMovingAverage3(price,prevEMA,time) {
  if (prevEMA.length === 0) {
    return price * 2/(time+1) + settings[0].startingAverage * (1-2/(time+1));
  } else {
    return price * 2/(time+1) + prevEMA[prevEMA.length - 1].ema99 * (1-2/(time+1));
  }
}
function calculateMovingAverage4(price,prevEMA,time) {
  if (prevEMA.length === 0) {
    return price * 2/(time+1) + settings[0].startingAverage * (1-2/(time+1));
  } else {
    return price * 2/(time+1) + prevEMA[prevEMA.length - 1].ema150 * (1-2/(time+1));
  }
}

function placeBuyOrder(buyPrice) {
  const finalBuyPrice = parseFloat(buyPrice);

  binance.buy(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), finalBuyPrice.toFixed(settings[0].decimalPlace), {}, buyResponse => {
    console.log('Bought @:', finalBuyPrice);
    console.log('Buy order id: ' + buyResponse);
    console.log(util.inspect(buyResponse, { showHidden: true, depth: null }));
  });
}

function placeSellOrder(price) {
  const sellPrice = parseFloat(price);

  binance.sell(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), sellPrice.toFixed(settings[0].decimalPlace), {}, sellResponse => {
    console.log('Sold @:', sellPrice);
    console.log('Sold order id: ' + sellResponse.orderId);
    console.log(util.inspect(sellResponse, { showHidden: true, depth: null }));
  });
}

function cancelBuy(orderNum) {
  binance.cancel(settings[0].ticker, orderNum, function(response, symbol) {
    console.log('Canceled order #: ', + orderNum);
  });
}

function cancelSell(orderNum) {
  binance.cancel(settings[0].ticker, orderNum, function(response, symbol) {
    console.log('Canceled order #: ', + orderNum);
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
