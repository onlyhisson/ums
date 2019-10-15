const express = require('express');
const router = express.Router();
//const global = require('./global.json');
const errMsg = require('./error_msg.json');
const zbgApiErr = require('./zbgApiErr.json');
const config = require('../config/config.json')
const agent = require('../public/util/api_call.js');
const common = require('../public/util/common.js');
const zbgFunc = require('../public/util/zbg_api_func.js');
const Promise = require('bluebird');

const WHC_USDT = 'WHC_USDT';    // 조회할 화폐 변수명
const API_TICKERS = '/v1/tickers' // 모든 화폐 시세 API
const API_TICKER = '/v1/ticker' // 해당 화폐 시세 API
const API_TRADES = '/v1/trades' // 체결 히스토리
const API_KLINES = '/v1/klines' // 차트 데이터
const API_ENTRUSTS = '/v1/entrusts' // 매수매도 호가
const COIN_LIST = ['BTC_USDT', 'ETH_USDT', 'XRP_USDT'/*, 'BCHABC_USDT', 'EOS_USDT', 'XLM_USDT'*/]
const TICKER_COL_NAMES = [
  '마켓 ID',  //  Market ID
  '전일종가', //  latest transaction price
  '고가',     //  highest price,
  '저가',     //  lowest price,
  '거래량', //  24h volume,
  '등락률', //  24h change,
  '종가표(last 6H)', // list of closing prices in last 6H 
  '매수호가',        // top buying price, 매수호가(살 가격)
  '매도호가',        // top selling price,  매도호가(파는 가격)
  '24H 거래량(구매자 통화 단위)'  //24h volume (in unit of the buyer's currency) // 
]
const KLINES_COL_NAMES = [
  'dataType', // data type, 
  '마켓 ID', // market id, 
  '시장명', // market name, 
  '시간', // time stamp, 
  '시작가', // opening data, 
  '고가', // highest price, 
  '저가', // lowest price, 
  '종가', // closing price, 
  '거래량', // volume, 
  '변동률', // change, 
  '달러 환율', // US dollar exchange rate, 
  '시간단위', // k-line cycle, 
  '개장 여부', // whether is converted, 
  '거래량(구매자 화폐 단위)', // volume (in unit of the buyer's currency)
]
const TRADES_COL_NAMES = [
  '데이터 타입',   //  Data type
  '마켓 ID',      //  market ID
  '시간',         //  stamp,
  '마켓명',       //  market name,
  '주문 타입',    //  type (asks or bids),
  '가격',        //  price,
  '거래량'       // amount
]

let statusTotalMarket = {}; // 시장 전체 시세 데이터
let mapCurIdName = [];

setInterval( 
  async () => {
    try {
      let total24h = await getTotal24hQuotation();
      let editTotal = await editTotalMarketStatus(total24h);
      statusTotalMarket = editTotal || {}
    } catch(error) {
      console.log('###### GLOBAL DATA CALL ERROR START #####')
      console.log(err)
      console.log('###### GLOBAL DATA CALL ERROR END   #####')
    }
  }
, 10000)

/***************************************************
# prepix : /zbg
***************************************************/

/* 거래소 메인 페이지 */
router.get('/', common.ensureAuth, async (req, res, next) => {
  //let statusTotalMarket = {};
  let statusMarket = [];
  let tradeHistory = [];
  let marketData = [];

  let keyObj = {};
  let assetsList = [];

  try {
    let data1 = await getTotal24hQuotation();
    let data2 = await editTotalMarketStatus(data1);
    statusTotalMarket = data2 || {}

    let data3 = await get24hQuotation();
    statusMarket = data3.datas || [];

    let data4 = await getTradeHistory();
    let data5 = await dateFormatBasic(data4.datas);
    tradeHistory = data5;

    let data6 = await getMarketData();
    marketData = data6.datas;

    let data7 = await zbgFunc.getZbgSecretKey(req.user.email)
    if(data7.length > 0) {
      keyObj.apiid = data7[0].apiid;
      keyObj.apikey = data7[0].apikey;
    }
    let data8 = await zbgFunc.getAssestInfo(keyObj)
    if(data8.datas)
      assetsList = data8.datas.list;

    res.render('zbg/index', 
      { 
        title: 'ZBG 대쉬보드',
        curType: 'WHC/USDT',
        coinList: COIN_LIST,
        statusTotalMarket,// 시세 데이터 total
        tickerColNames: TICKER_COL_NAMES,
        statusMarket,         // 시세 데이터 single
        tradesColNames: TRADES_COL_NAMES, 
        tradeHistory,         // 체결 이력 데이터
        marketData,            // 매도매수 호가 데이터
        klinesColNames: KLINES_COL_NAMES,
        reqTime: common.formatdateBasic2(new Date()),
        assetsList,
        sess: req.user
      }
    );

  } catch (err) {
    console.log(err)
    res.render('error', 
      { 
        code: 'API 통신 에러',
        message: errMsg[90002],
        sess: req.user
      }
    );
  }

});

/* 거래소 자산 보유 현황 */
router.get('/assets_status', common.ensureAuth, async (req, res, next) => {

  let keyObj = {};
  let assetsList = [];
  
  let payinList = [];
  let payinObj = {};
  let statusType = {};
  
  let payoutList = [];
  let payoutObj = {};
  let statusTypeOut = {};

  let err = {}
  err.code = 90004;
  err.message = errMsg[90004];

  try {
    let data1 = await zbgFunc.getZbgSecretKey(req.user.email);
    if(data1.length < 1)
      throw err
    keyObj.apiid = data1[0].apiid;
    keyObj.apikey = data1[0].apikey;

    let data2 = await zbgFunc.coinMappingData(keyObj)
    if(data2 == null) {
      err.code = 90003;
      err.message = errMsg[90003]
      throw err
    }

    let data3 = await getMarketIdName(data2)
    mapCurIdName = data3;

    let data4 = await zbgFunc.getAssestInfo(keyObj)
    assetsList = data4.datas.list || [];

    let data5 = await zbgFunc.getPayinCoinRecord(keyObj, payinObj)
    payinList = data5.datas.list || [];
    statusType = data5.statusType

    let data6 = await zbgFunc.getPayoutCoinRecord(keyObj, payoutObj)
    payoutList = data6.datas.list || [];
    statusTypeOut = data6.statusTypeOut

    res.render('zbg/assets', 
    {
      title: '자산 관리',
      mapCurIdName,   // 자산별 ID-NAME
      assetsList,
      payinList,
      statusType,
      statusTypeOut,
      payoutList,
      sess: req.user
    })

  } catch (err) {
    console.log(err)
    res.render('error', 
    { 
      code: err.code,
      message: err.message,
      sess: req.user
    });
  }
})



//////////////////////////////////////////////////////////////////////////////////////////
// ajax
//////////////////////////////////////////////////////////////////////////////////////////

/* 시세 데이터 ajax */
router.post('/ajax/get24hQuotation', async (req, res, next) => {
  
  let statusMarket = [];

  try {
    let data1 = await get24hQuotation();
    statusMarket = data1.datas || [];

    res.send({ 
      status: '_success_',
      tickerColNames: TICKER_COL_NAMES,
      statusMarket,
      reqTime: common.formatdateBasic2(new Date()),
    });
  } catch (err) {
    console.log(err) 
    res.send({
      status: '_error_',
      msg: '시세 조회 API 요청 에러, 현재 페이지를 재호출 하세요.'
    })
  }

})

/* 매도 매수 호가 ajax */
router.post('/ajax/getMarketData', async (req, res, next) => {
  let marketData = [];

  try {
    let data1 = await getMarketData();
    marketData = data1.datas || [];
    
    res.send({ 
      status: '_success_',
      marketData: marketData,
      reqTime: common.formatdateBasic2(new Date()),
    });
  } catch(err) {
    console.log(err) 
    res.send({
      status: '_error_',
      msg: '매도매수 호가 조회 API 요청 에러, 현재 페이지를 재호출 하세요.'
    })
  }

})

/* 체결 히스토리 ajax */
router.post('/ajax/getTradeHistory', async (req, res, next) => {
  let tradeHistory = [];

  try {
    let data1 = await getTradeHistory();
    let data2 = await dateFormatBasic(data1.datas);
    tradeHistory = data2 || [];

    res.send({ 
      status: '_success_',
      tradeHistory: tradeHistory,
      reqTime: common.formatdateBasic2(new Date()),
    });
  } catch(err) {
    console.log(err) 
    res.send({
      status: '_error_',
      msg: '체결 HISTORY API 요청 에러, 현재 페이지를 재호출 하세요.'
    })
  }
 
})

/* 차트 데이터 ajax */
router.post('/ajax/getKlines', common.ensureAuth, async (req, res, next) => {
  let klinesData = [];

  try {
    let data1 = await getKlines(req.body.period, req.body.dataSize);
    klinesData = data1.datas || [];

    let data2  = await editKinesData(klinesData)   
    klinesData = data2; 

    res.send({ 
      status: '_success_',
      klinesData: klinesData,
      reqTime: common.formatdateBasic2(new Date()),
    });
  } catch (err) {
    console.log(err) 
    res.send({
      status: '_error_',
      msg: '차트 데이터 API 요청 에러, 현재 페이지를 재호출 하세요.'
    })
  }

})

/* 차트 데이터2 ajax */
router.post('/ajax/getKlines2', common.ensureAuth, async (req, res, next) => {

  let klinesData = [];

  try {
    let data1 = await getKlines2(req.body.period, req.body.dataSize);
    klinesData = data1.datas || [];

    let data2 = await editKinesData2(klinesData);
    klinesData = data2;
    
    res.send({ 
      status: '_success_',
      klinesData
    });
  } catch(err) {
    console.log(err) 
    res.send({
      status: '_error_',
      msg: '차트 데이터 API 요청 에러, 현재 페이지를 재호출 하세요.'
    })
  }

})

router.post('/ajax/totalData', function(req, res, next) {
  let marketType = req.body.marketType;
  try {
    res.send({ 
      status: '_success_',
      marketOneData: statusTotalMarket[marketType]
    });
  } catch(e) {
    res.send({ 
      status: '_error_'
    });
    console.log('##### totalData Error Start #####')
    console.log(e)
    console.log('##### totalData Error End   #####')
  }
})

router.post('/ajax/entrustSellBuy', async (req, res, next) => {

  let keyObj = {};
  let bindVal = {};
  let errObj = {
    code: 90004,
    message: errMsg[90004]
  };

  bindVal['amount']       = req.body.amount;
  bindVal['rangeType']    = req.body.rangeType || 0;
  bindVal['type']         = req.body.type;
  bindVal['marketName']   = req.body.marketName || 'whc_usdt';
  bindVal['price']        = req.body.price;

  try {
    let data1 = await zbgFunc.getZbgSecretKey(req.user.email);
    if(data1.length > 0) {
      keyObj.apiid = data1[0].apiid;
      keyObj.apikey = data1[0].apikey;
    }

    let data2 = await zbgFunc.addEntrust(keyObj, bindVal);

    res.send({ 
      status: '_success_',
      code:data2.resMsg.code,
      msg: zbgApiErr[data2.resMsg.code]
    });
  } catch(err) {
    console.log(err)
    res.send({ 
      status: '_error_',
      code:errObj.code,
      msg: errObj.message
    });
  }

})

//////////////////////////////////////////////////////////////////////////////////////////
// function
//////////////////////////////////////////////////////////////////////////////////////////

// api host : https://www.zbg.com/help/httpQuotationApi

/* 1.1 24H Quotation of Total Market */
function getTotal24hQuotation () {

  let bindVal = {};
  bindVal['isUseMarketName'] = 'true';
  
  return new Promise(function(resolve, reject){  
    agent.zbgApi('get', API_TICKERS, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        //common.sendResultForm2(config.zbg_host+API_TICKERS, bindVal, result)
        resolve(result);
      }
    });
  });
}

/* 1.2 24H Quotation of Single Market */
function get24hQuotation () {

  let bindVal = {};
  bindVal['isUseMarketName'] = 'true';
  bindVal['marketName'] = WHC_USDT;
  
  return new Promise(function(resolve, reject){  
    agent.zbgApi('get', API_TICKER, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        //common.sendResultForm2(config.zbg_host+API_TICKER, bindVal, result)
        resolve(result);
      }
    });
  });
}

/* 1.3 K-Line */
function getKlines (dataType, dataSize) {

  let bindVal = {};
  bindVal['isUseMarketName'] = 'true';
  bindVal['marketName'] = WHC_USDT;
  bindVal['type'] = dataType || '1M'; //1M，5M，15M，30M，1H，1D，1W
  bindVal['dataSize'] = dataSize || 50; // max 100
  
  return new Promise(function(resolve, reject){  
    agent.zbgApi('get', API_KLINES, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        //common.sendResultForm2(config.zbg_host+API_KLINES, bindVal, result)
        resolve(result);
      }
    });
  });
}

/* 1.3 K-Line2 */
function getKlines2 (dataType, dataSize) {

  let bindVal = {};
  bindVal['isUseMarketName'] = 'true';
  bindVal['marketName'] = WHC_USDT;
  bindVal['type'] = dataType || '1M'; //1M，5M，15M，30M，1H，1D，1W
  bindVal['dataSize'] = dataSize || 50; // max 100
  
  return new Promise(function(resolve, reject){  
    agent.zbgApi('get', API_KLINES, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        //common.sendResultForm2(config.zbg_host+API_KLINES, bindVal, result)
        resolve(result);
      }
    });
  });
}

/* 1.4 Trading History */
function getTradeHistory () {

  let bindVal = {};
  bindVal['marketName'] = WHC_USDT;
  bindVal['dataSize'] = 20;

  return new Promise(function(resolve, reject){  
    agent.zbgApi('get', API_TRADES, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        //common.sendResultForm2(config.zbg_host+API_TRADES, bindVal, result)
        resolve(result);
      }
    });
  });
}

/* 1.5 Market Data */
function getMarketData () {

  let bindVal = {};
  bindVal['marketName'] = WHC_USDT;
  bindVal['dataSize'] = 9; // max 50

  return new Promise(function(resolve, reject){  
    agent.zbgApi('get', API_ENTRUSTS, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        //common.sendResultForm2(config.zbg_host+API_TRADES, bindVal, result)
        resolve(result);
      }
    });
  });
}

function dateFormatBasic (arr) {
  let newArr = [];
  let count = 0;
  return new Promise(function(resolve, reject){ 
    try{
      arr.forEach(element => {
        element[2] = common.formatdateBasic(Number(element[2]), 13)
        element[5] = Number(element[5]).toFixed(6)
        newArr.push(element);
        count++;
        if(count == arr.length)
          resolve(newArr)
      }); 
    } catch(e) {
      reject(e)
    }
  })  
}

function editTotalMarketStatus (arr) {
  let totalMarket = {};
  let count = 0;
  return new Promise(function(resolve, reject){ 
    try{
      COIN_LIST.forEach(function(el, idx) {
        totalMarket[el] = arr.datas[el]
        count++;
        if(count == COIN_LIST.length)
          resolve(totalMarket)
      })
    } catch(e) {
      console.log(e)
      reject(e)
    }
  })
}

function editKinesData (arr) {
  let newArr = [];
  let count = 0;
  let col3 = KLINES_COL_NAMES[3];
  let col7 = KLINES_COL_NAMES[7];
  return new Promise(function(resolve, reject){ 
    try{
      arr.forEach(element => {
        let newArrOne = {};
        newArrOne['time'] = common.formatdateBasic(Number(element[3]), 13)
        newArrOne['value'] = Number(element[7]).toFixed(6)
        newArr.unshift(newArrOne);
        count++;
        if(count == arr.length)
          resolve(newArr)
      }); 
    } catch(e) {
      reject(e)
    }
  })  
}

function editKinesData2 (arr) {
  let newArr = [];
  let count = 0;

  return new Promise(function(resolve, reject){ 
    try{
      arr.forEach(element => {
        let newArrOne = {};
        newArrOne['date'] = common.formatdateBasic3(Number(element[3])*1000)
        newArrOne['open'] = Number(element[4]).toFixed(6)
        newArrOne['high'] = Number(element[5]).toFixed(6)
        newArrOne['low'] = Number(element[6]).toFixed(6)
        newArrOne['close'] = Number(element[7]).toFixed(6)
        newArr.unshift(newArrOne);
        count++;
        if(count == arr.length)
          resolve(newArr)
      }); 
    } catch(e) {
      reject(e)
    }
  })  
}

/* ZBG 거래소 화폐별 데이터에서 id-name 값 데이터 추출 */
function getMarketIdName (arr) {
  let newArr = {};
  let count = 0;
  return new Promise(function(resolve, reject){ 
    try{
      arr.forEach(element => {
        //newArr[element.marketId] = element.name;
        newArr[element.sellerCurrencyId] = element.name;
        count++;
        if(count == arr.length) {
          resolve(newArr)
        }
      });
    } catch(e) {
      reject(e)
    }
  })
}

module.exports = router;
