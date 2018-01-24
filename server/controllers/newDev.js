const binance = require('node-binance-api');
const schedule = require('node-schedule');
const util = require('util');
const _ = require('lodash');

binance.options({
  'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
  'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV',
  test: true
});

let settings = [
  {
    settingName: 'Socket Trader',
    ticker: 'ETHUSDT',
    mainCurrency: 'ETH',
    secCurrency: 'USDT',
    cancelBuyCron: '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
    minSpread: 3.00,
    maxSpread: 10.00,
    decimalPlace: 2,
    avlToStart: 10,
    avlMax: 21,
    buyPad: 0.000000,
    sellPad: 0.000000,
    quantity: 0.05,
    buyPrice: null,
    buyOrderNum: null,
    sellOrderNum: null,
    sellPrice: null,
    state: null,
    bst: null,
    sst: null,
    bstLimit: 0.01,
    sstLimit: -0.01
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

  const debounceBuy = _.debounce(placeBuyOrder, 500, {leading: true, trailing: false});
  const debounceSell = _.debounce(placeSellOrder, 500, {leading: true, trailing: false});
  const debounceCancelBuy = _.debounce(cancelBuy, 500, {leading: true, trailing: false});
  const debounceCancelSell = _.debounce(cancelSell, 500, {leading: true, trailing: false});

  // // Periods: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
  // binance.websockets.candlesticks([settings[0].ticker], '4h', (candlesticks) => {
  //   let { e:eventType, E:eventTime, s:symbol, k:ticks } = candlesticks;
  //   let { o:open, h:high, l:low, c:close, v:volume, n:trades, i:interval, x:isFinal, q:quoteVolume, V:buyVolume, Q:quoteBuyVolume } = ticks;
  //   console.log(symbol+' '+interval+' candlestick update');
  //   console.log('open: '+open);
  //   console.log('high: '+high);
  //   console.log('low: '+low);
  //   console.log('close: '+close);
  //   console.log('volume: '+volume);
  //   console.log('isFinal: '+isFinal);
  // });

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
    if (buys.length >= settings[0].avlToStart) {
      const spread = getSpread(buys[buys.length - 1], sells[sells.length - 1]);
      let averageBuyPrice = _.meanBy(buys, 'price');
      let averageSellPrice = _.meanBy(sells, 'price');
      let buyPrice = parseFloat(buys[buys.length - 1].price);
      let currentSellPrice = parseFloat(sells[sells.length - 1].price);
      settings[0].bst = buyPrice - settings[0].buyPrice;
      settings[0].sst = currentSellPrice - settings[0].sellPrice;
      settings[0].buySellPad = spread * 0.10;
      console.log('buys:', buys.length, 'sells:', sells.length);
      console.log('SPD:', spread);
      console.log('BPR:', buyPrice);
      console.log('SPR:', currentSellPrice.toFixed(settings[0].decimalPlace));
      console.log('ABP:', averageBuyPrice.toFixed(settings[0].decimalPlace));
      console.log('ASP:', averageSellPrice.toFixed(settings[0].decimalPlace));
      console.log('BST:', buyPrice - settings[0].buyPrice);
      console.log('BON:', settings[0].buyOrderNum);
      console.log('SST:', currentSellPrice - settings[0].sellPrice);
      console.log('SON:', settings[0].sellOrderNum);
      console.log('STE:', settings[0].state);

      if (buyPrice <= averageBuyPrice && (spread >= settings[0].minSpread && spread <= settings[0].maxSpread)) {
        debounceBuy(buyPrice);
      } else if (settings[0].bst > settings[0].bstLimit && settings[0].buyOrderNum !== null) {
        debounceCancelBuy(settings[0].buyOrderNum);
      } else if (settings[0].sst < settings[0].sstLimit && settings[0].sellOrderNum !== null) {
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
        placeSellOrder(currentSellPrice);
        settings[0].buyPrice = null;
        settings[0].buyOrderNum = null;
        return;
      } else if (side === 'SELL' && orderStatus === 'FILLED') {
        settings[0].state = null;
        settings[0].sellPrice = null;
        settings[0].sellOrderNum = null;
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
      } else if (side === 'SELL' && orderStatus === 'CANCELED') {
        settings[0].state = null;
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

function placeBuyOrder(buyPrice, sellPrice) {
  const finalBuyPrice = parseFloat(buyPrice) + parseFloat(settings[0].buySellPad);

  binance.buy(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), finalBuyPrice.toFixed(settings[0].decimalPlace), {}, buyResponse => {
    console.log('Bought @:', finalBuyPrice);
    console.log('Buy order id: ' + buyResponse);
    console.log(util.inspect(buyResponse, { showHidden: true, depth: null }));
  });
}

function placeSellOrder(price) {
  const sellPrice = parseFloat(price) - parseFloat(settings[0].buySellPad);

  binance.sell(settings[0].ticker, settings[0].quantity.toFixed(settings[0].decimalPlace), sellPrice.toFixed(settings[0].decimalPlace), {}, sellResponse => {
    console.log('Sold @:', sellPrice);
    console.log('Sold order id: ' + sellResponse.orderId, sellResponse.code);
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
