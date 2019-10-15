const express = require('express');
const router = express.Router();
const global = require('./global.json');
const errMsg = require('./error_msg.json');
const agent = require('../public/util/api_call.js');
const common = require('../public/util/common.js');
const zbgFunc = require('../public/util/zbg_api_func.js');
const config = require('../config/config.json')
const Promise = require('bluebird')

const UMS_API_HOST = config.api_host;
const API_KYC = '/userapi/kyc';               // kyc 인증 요청
const API_CHANGE_PWD = '/userapi/change_pwd'; // 비밀번호 변경
const API_BIND_CARD = '/userapi/bind_card';   // 지정 엔젤카드, 카드번호 연동
const API_CARD_STAR = '/userapi/card_star';   // 엔젤 5등급

/***************************************************
# prepix : /users
***************************************************/


/* 사용자 정보 페이지 */
router.get('/user_info', common.ensureAuth, function(req, res, next) {

  let apiObj = {
    apiid: '',
    apikey: '',
    status: 0
  }

  Promise.try(function(){
    return zbgFunc.getZbgSecretKey(req.user.email)
  }).then(function(data) {
    if(data.length > 0) {
      apiObj.apiid= data[0].apiid;
      apiObj.apikey= data[0].apikey;
      apiObj.status= data[0].status;
    }

    res.render('users/user_info', 
      { 
        title: '사용자 정보',
        zbgApi : apiObj,
        sess: req.user
      }
    );
  }).catch(function(err) {
    console.log(err)
    res.render('error', 
      { 
        code: '로컬 시스템 에러',
        message: 'DB 데이터를 불러올 수 없습니다.',
        sess: req.user
      }
    );
  })
});

/* KYC 인증 페이지 */
router.get('/kyc', common.ensureAuth, function(req, res, next) {

  res.render('users/kyc', 
    { 
      title: 'KYC 인증',
      sess: req.user
    }
  );
});

/* 엔젤 5등급(KYC 신청서) 페이지 */
router.get('/kyc_req', common.ensureAuth, function(req, res, next) {
  res.render('users/kyc_req', 
    { 
      title: 'KYC 신청서',
      sess: req.user

    }
  );
});

/* 지정 엔젤카드(카드번호 연동) 페이지 */
router.get('/angel_card', common.ensureAuth, function(req, res, next) {
  res.render('users/angel_card', 
    { 
      title: '카드번호 연동',
      sess: req.user

    }
  );
});

/* 비밀번호 수정 페이지 */
router.get('/update_pw', common.ensureAuth, function(req, res, next) {
  res.render('users/update_pw', 
    { 
      title: '비밀번호 수정',
      sess: req.user

    }
  );
});


//////////////////////////////////////////////////////////////////////////////////////////
// ajax
//////////////////////////////////////////////////////////////////////////////////////////

/* ZBG 거래소 API insert */
router.post('/ajax/updateApiInfo', common.ensureAuth, function(req, res, next) {

  let apiId = req.body.api_id || '';
  let apiKey = req.body.api_key || '';

  Promise.try(function(){
    return zbgFunc.getZbgSecretKey(req.user.email)
  }).then(function(data) {
    if(data.length > 0){
      return updateZbgApiInfo(req.user.email, apiId, apiKey)
    } else {
      return insertZbgApiInfo(req.user.email, apiId, apiKey)
    }
  }).then(function(data) {
    console.log(data)
    res.send({
      status: '_success_',
      msg: 'ZBG 거래소 API 입력 완료'
    })
  }).catch(function(err){
    console.log(err)
    res.send({
      status: '_error_', 
      code: '90001',
      msg: errMsg[90001]
    })
  })
});

/* kyc 인증요청 */
router.post('/ajax/kyc_auth', common.ensureAuth, function(req, res, next) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['country'] = req.body.country;
  bindVal['area_code'] = req.body.area_code;
  bindVal['mobile'] = req.body.mobile;
  bindVal['first_name'] = req.body.first_name;
  bindVal['last_name'] = req.body.last_name;
  bindVal['card_type'] = req.body.card_type;
  bindVal['card_no'] = req.body.card_no;
  bindVal['gender'] = req.body.gender;
  bindVal['birthdate'] = req.body.birthdate;
  bindVal['address'] = req.body.address;
  bindVal['address_pic'] = req.body.address_pic;
  bindVal['card_pic'] = req.body.card_pic;
  bindVal['card_pic2'] = req.body.card_pic2;
  bindVal['hand_pic'] = req.body.hand_pic;
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  agent.callApi('post', API_KYC, bindVal, function (err, result) {

    if(err) {
      res.send({
        status: '_error_', 
        code: '90000',
        msg: errMsg[90000]
      })
    } else {
      common.sendResultForm(UMS_API_HOST + API_KYC, bindVal, result)

      res.send({
        status: '_success_', 
        code: result.status,
        msg: errMsg[result.status]
      })
    }
  });
});

/* 비밀번호 변경 */
router.post('/ajax/update_pw', common.ensureAuth, function(req, res, next) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['pwd'] = req.body.pwd;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);
  
  agent.callApi('post', API_CHANGE_PWD, bindVal, function (err, result) {

    if(err) {
      res.send({
        status: '_error_', 
        code: '90000',
        msg: errMsg[90000]
      })
    } else {
      common.sendResultForm(UMS_API_HOST + API_CHANGE_PWD, bindVal, result)

      res.send({
        status: '_success_', 
        code: result.status,
        msg: errMsg[result.status]
      })
    }
  });

});

/* 지정 엔젤카드, 카드번호 연동 */
router.post('/ajax/bindCard', common.ensureAuth, function(req, res, next) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['card_no'] = req.body.card_no;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);
  
  agent.callApi('post', API_BIND_CARD, bindVal, function (err, result) {

    if(err) {
      res.send({
        status: '_error_', 
        code: '90000',
        msg: errMsg[90000]
      })
    } else {
      common.sendResultForm(UMS_API_HOST + API_BIND_CARD, bindVal, result)
  
      res.send({
        status: '_success_', 
        code: result.status,
        msg: errMsg[result.status]
      })
    }
  });

});


/* 엔젤 5등급 */
router.post('/ajax/sendKycForm', common.ensureAuth, function(req, res, next) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['card_no'] = req.body.card_no;
  bindVal['file_url'] = req.body.file_url;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  agent.callApi('post', API_CARD_STAR, bindVal, function (err, result) {

    if(err) {
      res.send({
        status: '_error_', 
        code: '1000'    // ums.error 로컬 서버 데이터 요청 에러
      })
    } else {
      common.sendResultForm(UMS_API_HOST + API_CARD_STAR, bindVal, result)
  
      res.send({
        status: '_success_', 
        code: result.status,
        msg: errMsg[result.status]
      })
    }
  });

});

//////////////////////////////////////////////////////////////////////////////////////////
// function
//////////////////////////////////////////////////////////////////////////////////////////

/* ZBG API 거래소 API insert */
function insertZbgApiInfo (id, apiId, apiKey) {
  let qry = ` INSERT INTO ums.users ( ` + 
            `   id,  ` +
            `   zbg_api_id,  ` +
            `   zbg_api_key,  ` +
            `   status, ` +
            `   update_time  ` +
            ` ) VALUES ( ` +
            `   '${id}',  ` +
            `   '${apiId}',     ` + 
            `   '${apiKey}',  ` +
            `   1, ` +
            `   NOW() ` +
            ` ); ` 
  return new Promise(function(resolve, reject){  
    common.exeQuery(qry, function (err, result) {
      if(err) {
        reject(err)
      } else {
        resolve(result);
      }
    });
  });
}

/* ZBG API 거래소 API update */
function updateZbgApiInfo (id, apiId, apiKey) {
  let qry =  ` UPDATE	ums.users  ` +
              ` SET	 ` +
              `   zbg_api_id = '${apiId}', ` +
              `   zbg_api_key = '${apiKey}' ` +
              ` WHERE id = '${id}' `
  return new Promise(function(resolve, reject){  
    common.exeQuery(qry, function (err, result) {
      if(err) {
        reject(err)
      } else {
        resolve(result);
      }
    });
  });
}

module.exports = router;
