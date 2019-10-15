var express = require('express');
var router = express.Router();
var global = require('./global.json');
var errMsg = require('./error_msg.json');
var agent = require('../public/util/api_call.js');
var common = require('../public/util/common.js');
var config = require('../config/config.json')
var Promise = require('bluebird');

const UMS_API_HOST = config.api_host;
const API_ACCEPT_CARD = '/userapi/accept_card';   // 오프라인 입금 은행카드 리스트
const API_AMT_DEPOSIT = '/userapi/amt_deposit';   // 오프라인 입금
const API_AMT_RECORD = '/userapi/amt_record';     // 오프라인 입금 리스트
const API_LINE_DEPOSIT = '/userapi/line_deposit'; // 온라인 입금
const API_LINE_RECORD = '/userapi/line_record';   // 온라인 입금 리스트

const DEP_STATUS = {
  0: "미지급",
  1: "대리심사 통과",
  2: "성공",
  3: "대리 거절"
}

const STATUS_COLOR = {
  0: "label-white",
  1: "label-info",
  2: "label-success",
  3: "label-danger"
}

const CUR_TYPE = {
  1: "RMB",
  2: "HKD",
  3: "USD"
}

const EPAY_STATUS = {
  0: "미지급",
  1: "지급 실패",
  2: "지급 성공"
}

const EPAY_ST_COLOR = {
  0: "label-white",
  1: "label-danger",
  2: "label-success"
}

const TEMP_TOTAL_DATA  = [
  {
    "order_no": "121000040",
    "order_date": "May 23, 2014 11:47:56 PM",
    "price": "100.12",
    "insert_cur_type": "홍콩달러",
    "card_cur_type": "$",
    "status": "success",
  },
  {
    "order_no": "121000040",
    "order_date": "May 23, 2014 11:47:56 PM",
    "price": "100.12",
    "insert_cur_type": "홍콩달러",
    "card_cur_type": "$",
    "status": "success",
  }
]

/***************************************************
# prepix : /deposit
***************************************************/
router.get('/deposit_cash_req', common.ensureAuth, function(req, res, next) {

  let token = req.user.token
  Promise.all([getAcceptCardList(token)])
  .then(values => {
    req.user.accCardList = [];
    req.user.accCardList = values[0]; 
    res.render('deposit/deposit_cash_req', { 
      title: '충전신청(현금)',
      sess: req.user
    });
  })
  .catch(error => {
    console.log(error);
    res.render('error', {
      code: '',
      msg: 'API 서버 통신 에러'
    })
  })

});

router.get('/deposit_cash_bd', common.ensureAuth, function(req, res, next) {

  console.log(req.user)
  let token = req.user.token

  Promise.all([getDepCashList(token)])
  .then(values => {
    let depCashList = values[0].data.list || [];
    res.render('deposit/deposit_cash_bd', { 
      title: '충전내역(현금)',
      sess: req.user,
      depCashList: depCashList,
      dep_status: DEP_STATUS,
      cur_type: CUR_TYPE,
      status_color: STATUS_COLOR
    });
  })
  .catch(error => {
    console.log(error);
    res.render('error', {
      code: '',
      msg: 'API 서버 통신 에러'
    })
  })
});

router.get('/deposit_crypto_currency', common.ensureAuth, function(req, res, next) {
  res.render('deposit/deposit_crypto_currency', 
    { 
      title: '암호화폐 입금',
      sess:req.user
    }
  );
});

router.get('/deposit_epay_req', common.ensureAuth, function(req, res, next) {

  let token = req.user.token
  Promise.all([getAcceptCardList(token)])
  .then(values => {
    req.user.accCardList = [];
    req.user.accCardList = values[0]; 
    res.render('deposit/deposit_epay_req', { 
      title: '충전신청(EPAY)',
      sess: req.user
    });
  })
  .catch(error => {
    console.log(error);
    res.render('error', {
      code: '',
      msg: 'API 서버 통신 에러'
    })
  })
});

router.get('/deposit_epay_bd', common.ensureAuth, function(req, res, next) {

  Promise.all([lineRecord(req, {})])
  .then(values => {
    let epayList = [];
    if(values[0].status == 10000)
      epayList = values[0].data.list;
      
    res.render('deposit/deposit_epay_bd', 
      { 
        title: '충전내역(EPAY)',
        sess:req.user,
        epayList: epayList,
        epayStatus: EPAY_STATUS,
        epayStColor: EPAY_ST_COLOR
      }
    );
  })
  .catch(error => {
    console.log(error);
    res.render('error', {
      code: '',
      msg: 'API 서버 통신 에러'
    })
  })
  
});

router.get('/deposit_total_bd', common.ensureAuth, function(req, res, next) {

  res.render('deposit/deposit_total_bd', 
    { 
      title: '총입금내역 현황(임시 데이터)',
      sess:req.user,
      depositTotalList: TEMP_TOTAL_DATA
    }
  );
});

//////////////////////////////////////////////////////////////////////////////////////////
// ajax
//////////////////////////////////////////////////////////////////////////////////////////

/* 
    1. 문의 이미지 서버저장
    2. api서버 전송
    3. api서버 이미지 경로(URL) return 
*/
router.post('/ajax/getImageUrl', common.ensureAuth, function(req, res, next){
  var file_name = '';
  var pic_url = '';

  Promise.try(function(){
      return common.saveImage(req, res); // local 에 이미지 저장
  }).then(function(data) {
      file_name = data.fileName;
      return common.uploadApi(req.user.token, file_name) // api 서버에 이미지 전송
  }).then(function(data) {
      pic_url = data.url || '';
      return common.deleteFile(file_name);   // local 에 저장했던 이미지 삭제
  }).then(function(data) {
      res.json({
          status: '_success_',
          picUrl: pic_url
      })
  }).catch(function(err){ 
    console.log(err)
      res.json({
          status: '_error_'
      })
  })  
})

/* 충전신청(현금) */
router.post('/ajax/req_deposit_cash', common.ensureAuth, function(req, res, next) {
  
  Promise.try(function(){
      return amtDeposit(req)
  }).then(function(data) {
        res.json({
        status: '_success_',
        code: data.status,
        msg: errMsg[data.status],
        url: '/deposit/deposit_cash_bd'
    })
  }).catch(function(err){
        res.json({
        status:'_error_',
        msg: 'API 통신 에러'
    })
  })
});

/* 충전신청(현금) */
router.post('/ajax/req_deposit_epay', common.ensureAuth, function(req, res, next) {

  /*
  if(req.user.is_kyc != 2) {
    res.json({
      status:'_error_',
      msg: 'KYC 인증이 필요합니다.'
    })
    return;
  }
  */

  Promise.try(function(){
      return lineDeposit(req)
  }).then(function(data) {
    let url = data.url || '';
    
    // 해당페이지 응답 성공 Temp 데이터
    if(req.user.email == 'test3@163.com')
      url = 'https://www.ums.hk/userapi/jump/order_sn/19091915054409035042/sign/C835619C1F7CA41C7913EAD39A214C23'

    res.json({
      status: '_success_',
      code: data.status,
      msg: errMsg[data.status],
      url: url
    })
  }).catch(function(err){
        res.json({
        status:'_error_',
        msg: 'API 통신 에러'
    })
  })
});

//////////////////////////////////////////////////////////////////////////////////////////
// function
//////////////////////////////////////////////////////////////////////////////////////////

/* 1.1.8. 오프라인 입금 은행카드 리스트 */
function getAcceptCardList (token) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_ACCEPT_CARD, bindVal, function (err, result) {
      if(err) {
        reject(err)
      } else if(result.status == 10000) {
        common.sendResultForm(UMS_API_HOST + API_ACCEPT_CARD, bindVal, result)
        resolve(result.data);
      } else {
        resolve('')
      }
    });
  });
}

/* 1.1.9. 오프라인 입금 */
function amtDeposit (req) {
  let date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['card_no'] = req.body.card_no || '';
  bindVal['from_card'] = req.body.from_card;
  bindVal['price'] = req.body.price;
  bindVal['order_date'] = req.body.order_date || date;
  bindVal['pic_url'] = req.body.pic_url;
  bindVal['accept_card'] = req.body.accept_card;
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  
  return new Promise(function(resolve, reject){  
    
    agent.callApi('post', API_AMT_DEPOSIT, bindVal, function (err, result) {
      if(err) {
        reject(err)
      } else {
        common.sendResultForm(UMS_API_HOST + API_AMT_DEPOSIT, bindVal, result)
        resolve(result);
      }
    });
    
  });
}

/* 1.1.10. 오프라인 입금 명세 */
function getDepCashList (token, page, limit) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['status'] = 0; // 0모두， 1대리 삼사 통과，2성공，3대리 거절，4플랫폼 거절  5심사 대기 
  bindVal['p'] = page || 1;
  bindVal['limit'] = limit || 10;
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_AMT_RECORD, bindVal, function (err, result) {
      if(err) {
        reject(err)
      } else {
        common.sendResultForm(UMS_API_HOST + API_AMT_RECORD, bindVal, result)
        resolve(result);
      } 
    });
  });
}

/* 1.1.11. 온라인 입금 */
function lineDeposit (req) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['card_no'] = req.body.card_no;
  bindVal['price'] = req.body.price;
  bindVal['channel'] = req.body.channel;
  bindVal['channel_type'] = req.body.channel_type;
  bindVal['return_url'] = req.body.return_url || 'https://www.baidu.com/';
  bindVal['error_url'] = req.body.error_url || 'https://www.baidu.com/';
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_LINE_DEPOSIT, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else {
        common.sendResultForm(UMS_API_HOST + API_LINE_DEPOSIT, bindVal, result)
        resolve(result);
      }
    });
  });
}

/* 1.1.12. 온라인 입금 명세 */
function lineRecord (req, obj) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['status'] = obj.status || 0;             // 0모두， 1실패， 2성공， 3미지급
  bindVal['p'] = obj.p || 1;
  bindVal['limit'] = obj.limit || 10;
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_LINE_RECORD, bindVal, function (err, result) {
      if(err) {
        console.log(err)
        reject(err)
      } else if(result) {
        common.sendResultForm(UMS_API_HOST + API_LINE_RECORD, bindVal, result)
        resolve(result);
      } 
    });
  });
}

module.exports = router;
