const currencies = [
  {
    'ticker': 'XRPETH',
    'settings': {
      mainInterval: '5s',
      minSpread: 0.00000400,
      avgSpreadLimiter: 0.00000400,

      decimalPlace: 8,
      avlToStart: 6,
      avlMax: 7,

      currency: 'XRPETH',
      mainCurrency: 'ETH',
      secCurrency: 'XRP',

      cstRelistSell: -0.00000500,
      cstReSellLimit: -0.00000010,

      cstStopLossStart: -0.00001000,
      cstStopLossEnd: -0.00003000,
      cstMaxToCancelBuy: 0.00000005,

      LeftOverLimi: 15,
      SellLeftOverAt: 20,

      buyPad: 0.00000011,
      sellPad: 0.00000011,

      quantity: 50,
      avgSpread: [],
      avgHigh: [],
      avgLow :[]
    }
  }
];

export default currencies;
