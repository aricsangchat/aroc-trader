const binance = require('node-binance-api');
const schedule = require('node-schedule');

const mainInterval = '30s';
const minSpread = 0.00000400;
const avgSpreadLimiter = 0.00000400;

const decimalPlace = 8;
const avlToStart = 100;
const avlMax = 101;

const mainCurrency = 'ETH';
// const currency = 'XRPETH';
// const secCurrency = 'XRP';

const cstRelistSell = -0.00000500;
const cstStopLossStart = -0.00001000;
const cstStopLossEnd = -0.00003000;
const cstMaxToCancelBuy = 0.00000003;
const cstReSellLimit = 0.00000003;

const LeftOverLimit = 20;
const buyPad = 0.00000011;
const sellPad = 0.00000011;

let currency = null;
let secCurrency = null;
let quantity = 0;
let spread = null;
let avgerageSpread = [];
let allOpenOrders = [];
let spd = null;
let tickerInfo = null;
let secCurrencyBalance = null;
let avs = null;

const currencies = [
  'ADX',
  'CMT',
  'BCP',
  'BNB',
  'ICX'
];
//let avgSpread = [];
//let avgHigh = [];
//let avgLow = [];
//let secondCurrencyArray = [];

// let TradeHistoryProfit = [];


binance.options({
  'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
  'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
});

exports.startProgram = () => {

  const j = schedule.scheduleJob(getMainInterval(mainInterval), () => {
    binance.balance(balances => {
      console.log('ETH: ', balances[mainCurrency].available);
      //console.log('XRP: ', balances[secCurrency].available);
      console.log('BNB: ', balances.BNB.available);
      //secCurrencyBalance = balances[secCurrency].available;
    });

    binance.bookTickers((ticker) => {
      // tickerInfo = ticker;
      // spd = ticker[currency].ask - ticker[currency].bid;
      // avgSpread.push(spd);

      for(let stock in ticker) {
        if (ticker.hasOwnProperty(stock) && stock.includes(mainCurrency)) {
          spread = ticker[stock].ask - ticker[stock].bid;
          if (spread.toFixed(8) < 0.00001000 && spread.toFixed(8) > 0.00000600) {
            avgerageSpread.push(spread);
            if (avgerageSpread.length == avlMax) {
              avgerageSpread.shift();
            }
            console.log(stock);
            console.log('SPD: ' + spread.toFixed(8));
            console.log('AVS: ', getAverageSpread(avgerageSpread));
            console.log('AVL: ', avgerageSpread.length);
            //mainCurrency = stock.substring(str.length - 3, str.length);
            //secCurrency = stock.substring(0, stock.length - 3);
            if (avgerageSpread.length < avlToStart) {
              console.log('Waiting for AVL level ' + avlToStart + '...');
              console.log('******************************');
            } else {
              binance.openOrders(currency, (openOrders, symbol) => {
                allOpenOrders = openOrders;

                if (allOpenOrders.length == 0 && secCurrencyBalance > LeftOverLimit) {
                  console.log('Selling leftover...');
                  sellLeftover();
                } else if (allOpenOrders.length == 0) {
                  console.log('No Open Orders.');

                  if (spd.toFixed(decimalPlace) >= minSpread && getAverageSpread(avlToStart) >= avgSpreadLimiter) {
                    console.log('SPD && AVS: Match');
                    makeBuyOrder(tickerInfo[currency].bid, spd);

                  } else {
                    console.log('SPD && AVS: MisMatch');
                    console.log('******************************');
                  }

                } else {
                  allOpenOrders.forEach(openOrder => {
                    console.log('OPD', openOrder.side, 'at', openOrder.price);

                    if (openOrder.side == 'SELL') {
                      console.log('CST', openOrder.side, 'at', calculateMargin(openOrder.price, tickerInfo[currency].ask));

                      // if (spd.toFixed(decimalPlace) >= minSpread && spd.toFixed(decimalPlace) >= avgSpreadLimiter) {
                      //console.log('SPD && AVS: Match');
                      if ( calculateMargin(openOrder.price, tickerInfo[currency].ask) == cstReSellLimit) {
                        console.log('No Need to Re-List Sell...');
                      }
                      else {
                        console.log('Relisting Sell...');
                        relistSell(calculateMargin(openOrder.price, tickerInfo[currency].ask), openOrder.price);
                      }
                      // } else {
                      //   console.log('SPD && AVS: MisMatch');
                      // }

                    } else {
                      console.log('CST', openOrder.side, 'at', calculateMargin(openOrder.price, tickerInfo[currency].bid));

                      if (spd.toFixed(decimalPlace) >= minSpread && spd.toFixed(decimalPlace) >= avgSpreadLimiter) {
                        console.log('SPD && AVS: Match');

                        if (calculateMargin(openOrder.price, tickerInfo[currency].bid) > cstMaxToCancelBuy) {
                          binance.cancel(currency, openOrder.orderId, function(response, symbol) {
                            console.log('Canceled order #: ', + openOrder.orderId);

                          });
                        } else {
                          console.log('CST: MisMatch');
                          console.log('Status: Open');
                          console.log('******************************');
                        }
                      } else {
                        console.log('SPD && AVS: MisMatch');
                        console.log('******************************');
                      }
                    }
                  });
                }
              });
            }
          }
        }
      }

      //console.log('Ask: ', ticker[currency].ask);
      //console.log('Bid: ', ticker[currency].bid);
      //console.log('SPD: ', spd.toFixed(decimalPlace));
      //console.log('AVS: ', getAverageSpread(avgSpread));
      //console.log('AVL: ', avgSpread.length);
      //binance.buy(currency, quantity, ticker[currency].bid);

      // if (avgSpread.length == avlMax) {
      //   avgSpread.shift();
      // }
    });
  });
};

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
