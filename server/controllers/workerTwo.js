require('babel-register');
const binance = require('node-binance-api');
const schedule = require('node-schedule');

const mainInterval = '5s';
const minSpread = 0.00004000;
const avgSpreadLimiter = 0.00004000;

const decimalPlace = 8;
const avlToStart = 6;
const avlMax = 7;

const currency = 'ARNETH';
const mainCurrency = 'ETH';
const secCurrency = 'ARN';

const cstRelistSell = -0.00001000;
const cstReSellLimit = -0.00000500;

const cstStopLossStart = -0.00002000;
const cstStopLossEnd = -0.00020000;
const cstMaxToCancelBuy = 0.00000100;

const LeftOverLimit = 0;
const SellLeftOverAt = 1;

const buyPad = 0.00000100;
const sellPad = 0.00000100;

let quantity = 10;
let avgSpread = [];
let avgHigh = [];
let avgLow = [];

binance.options({
  'APIKEY':'zs4zBQPvwO9RW9aQd2FSDF8zNVZmFWTJajrczPvshygpXo00ft1ESlYyI3LI9hWU',
  'APISECRET':'oYtkOlUZlq8sS8pjU68JKQYeWwEaHxQI2g87x5akySl3OjVfiX40z0GcFu4VjCBV'
});

exports.startProgram = (req, res, next) => {
  let TradeHistoryProfit = [];
  let allOpenOrders = [];
  let spd = null,
    tickerInfo = null,
    secCurrencyBalance = null;

  const j = schedule.scheduleJob(getMainInterval(mainInterval), () => {
    binance.balance(balances => {
      console.log('ETH: ', balances[mainCurrency].available);
      console.log(secCurrency + ': ' + balances[secCurrency].available);
      console.log('BNB: ', balances.BNB.available);
      secCurrencyBalance = balances[secCurrency].available;
    });

    binance.bookTickers((ticker) => {
      tickerInfo = ticker;
      spd = ticker[currency].ask - ticker[currency].bid;
      avgSpread.push(spd);

      console.log('Ask: ', ticker[currency].ask);
      console.log('Bid: ', ticker[currency].bid);
      console.log('SPD: ', spd.toFixed(decimalPlace));
      console.log('AVS: ', getAverageSpread(avgSpread));
      console.log('AVL: ', avgSpread.length);
      //binance.buy(currency, quantity, ticker[currency].bid);

      if (avgSpread.length == avlMax) {
        avgSpread.shift();
      }

      if (avgSpread.length < avlToStart) {
        console.log('Waiting for AVL level ' + avlToStart + '...');
        console.log('******************************');
      } else {
        binance.openOrders(currency, (openOrders, symbol) => {
          allOpenOrders = openOrders;

          if (allOpenOrders.length == 0 && secCurrencyBalance > SellLeftOverAt) {
            sellLeftover(secCurrencyBalance, ticker[currency].ask);
          } else if (allOpenOrders.length == 0) {
            console.log('No Open Orders.');

            if (spd.toFixed(decimalPlace) >= minSpread && getAverageSpread(avgSpread) >= avgSpreadLimiter) {
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
                if ( calculateMargin(openOrder.price, tickerInfo[currency].ask) >= cstReSellLimit) {
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

  binance.buy(currency, quantity, buyPrice.toFixed(decimalPlace), {}, buyResponse => {
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

function sellLeftover(leftOverBalance, currentAskPrice) {
  const quantityToSell = leftOverBalance - LeftOverLimit;
  const sellPrice = parseFloat(currentAskPrice) - parseFloat(sellPad);
  binance.sell(currency, Math.floor(quantityToSell), sellPrice.toFixed(decimalPlace), {}, leftOverSellResponse => {
    console.log('Tried to sell leftover...');
    console.log('Left over qty:', Math.floor(quantityToSell));
    console.log('Sold Left Over @: ', sellPrice.toFixed(decimalPlace));
    console.log('Sell order id: ' + leftOverSellResponse.orderId);
    console.log('******************************');
  });
}
