var express = require('express');
var router = express.Router();
var global = require('./global.json');
var errMsg = require('./error_msg.json');
var agent = require('../public/util/api_call.js');
var common = require('../public/util/common.js');
var config = require('../config/config.json');
var passport = require('passport');
var Promise = require('bluebird');

const UMS_API_HOST = config.api_host;
const API_REGISTER = '/userapi/register';
const API_NOTICE_CATE = '/userapi/notice_cate';
const API_NOTICE_RECORD = '/userapi/notice_record';
const API_LANGUAGE = '/userapi/language';

/***************************************************
# prepix : /
***************************************************/

/* GET home page. */
router.get('/', common.ensureAuth, async (req, res, next) => {

  let token = req.user.token;
  let noticeOneList = [];     // 해당 공지사항 데이터 리스트
  req.user.noticeList = [];

  try {
    let data1 = await getNoticeList(token);
    req.user.noticeList = data1; // 공지사항 카테고리

    let data2 = await getNoticeOneList(req);
    noticeOneList = data2.list;

    let data3 = await getLangList(token);
    req.user.langList = data3; // Language 목록
    
    // kyc 통과되지 않거나 다시 제출 필요시
    if((!req.user.kycCheck && req.user.is_kyc == 0) || (!req.user.kycCheck && req.user.is_kyc == 3)) { 
      req.user.kycCheck = true;
      res.redirect('/users/kyc')
    } else {
      res.render('index', { 
        title: '공지사항',
        sess: req.user,
        noticeOneList
      });
    }

  } catch(err) {
    console.log(err)
    /*
    req.send({
      code:'20000',
      msg: 'error'
    })
    */
  }
});

router.post('/login', passport.authenticate('local', {
  failureRedirect: '/login_fail',   // 로그인 실패시 URI
  failureFlash: true 
}), function(req, res){
    res.send({
      status: '_success_'
    });
});

router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

router.get('/login_fail', function(req, res, next){
  //console.log(req.flash('error'));
  //res.send('_error_')
  let failData = req.flash('loginFailed')[0]
  console.log('********************')
  console.log(failData)
  console.log(failData.status)
  console.log(errMsg[failData.status])
  console.log('********************')

  res.send({
    status: '_error_',
    code: failData.status,
    msg: errMsg[failData.status]
  })
});

/*
router.get('/login_fail',function(req, res, next){
  console.log(req.flash('error'));
  res.redirect('/');
});

router.get('/logout', function(req, res, next) {
  res.render('login', 
  { 
    title: '' 
  }
  );
});
*/

router.post('/register', function(req, res, next) {

  let bindVal = {};
  bindVal['merchant_id'] = req.body.merchant_id;
  bindVal['email'] = req.body.email;
  bindVal['first_name'] = req.body.last_name;
  bindVal['last_name'] = req.body.first_name;
  bindVal['card_no'] = req.body.card_no;
  bindVal['pwd'] = req.body.pwd;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);
    
  agent.callApi('post', API_REGISTER, bindVal, function (err, result, callback) {
    if(err) {
      res.send({
        status: '_error_', 
        code: '90000',
        msg: errMsg[90000]
      })
    } else {
      common.sendResultForm(UMS_API_HOST + API_REGISTER, bindVal, result)
      res.send({
        status: '_success_', 
        code: result.status,
        msg: errMsg[result.status]
      })
    }
  });
});

router.get('/notice_detail/:cateId/:postId', common.ensureAuth, async (req, res, next) => {

  let cateId = req.params.cateId;
  let postId = req.params.postId;
  let detailTitle = '';
  let noticeDetail = {};

  req.user.noticeList.forEach(element => {
    if(element.id == cateId) {
      detailTitle = element.title;
    }
  });

  try {
    let data1 = await getNoticeOneList(req, cateId);
    noticeDetail = data1.list.find(function (n){
      return n.id == postId;
    })

    res.render('notice_detail', 
      { 
        title: detailTitle,
        sess:req.user,
        postTitle: noticeDetail.title,
        createTime: noticeDetail.create_at,
        noticeDetail:noticeDetail.data,
        picUrl:noticeDetail.pic_url
    });
  } catch(err) {
    console.log(err)
    // 에러처리 필요함 
    res.render('error', 
    { 
      code: 90000,
      message: errMsg[90000]
    })
  }
});

router.get('/user_protocol', common.ensureAuth, function(req, res, next) {
  res.render('user_protocol', 
    { 
      //title: '' 
    }
  );
});

//////////////////////////////////////////////////////////////////////////////////////////
// ajax
//////////////////////////////////////////////////////////////////////////////////////////

/* 공지사항 카테고리 선택시 해당 공지사항 리스트 조회 */
router.post('/ajax/getNoticeOneList', async (req, res, next) => {

  let token = req.user.token;
  let cateId = req.body.cateId;
  let noticeList = [];
  let noticeOneList = [];

  try {
    let data1 = await getNoticeList(token);
    noticeList = data1; // 공지사항 카테고리

    let data2 = await getNoticeOneList(req, cateId);
    noticeOneList = data2.list;

    res.json({
      status: '_success_',
      noticeList,
      noticeOneList
    })
  } catch(err) {
    console.log(err)
    res.json({
      status:'_error_',
      msg: 'API 통신 에러'
    })
  }
});

/* 이미지 업로드 공통함수 */
router.post('/ajax/getImageUrl', common.ensureAuth, function(req, res, next){
  var file_name = '';
  var pic_url = '';

  Promise.try(function(){
      return common.saveImage(req, res); // local 에 이미지 저장
  }).then(function(data) {
      file_name = data.fileName;
      return common.uploadApi(req.user.token, file_name) // api 서버에 이미지 전송
  }).then(function(data) {
      pic_url = data.url
      return common.deleteFile(file_name);   // local 에 저장했던 이미지 삭제
  }).then(function(data) {
      res.json({
          status: '_success_',
          picUrl: pic_url
      })
  }).catch(function(err){ 
    if(err.name == 'MulterError') {
      res.json({
        status: '_error_',
        msg: err.msg
      })
    } else {
      res.json({
        status: '_error_',
        msg: 'API 서버 이미지 업로드 실패'
      })
    }
  })  
})

//////////////////////////////////////////////////////////////////////////////////////////
// function
//////////////////////////////////////////////////////////////////////////////////////////

/* 공지사항 카테고리 조회 */
function getNoticeList (token) {
  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_NOTICE_CATE, bindVal, function (err, result) {
      if(err) {
        reject(err)
      } else if(result.status == 10000) {
        common.sendResultForm(UMS_API_HOST + API_NOTICE_CATE, bindVal, result)
        resolve(result.data);
      } else {
        resolve('');
      }
    });
  });
}

/* 공지사항 해당 카테고리 목록 조회 */
function getNoticeOneList (req, cateId, pageNum, limit) {

  let initNoticeNum = '';
  if(cateId == undefined && req.user.noticeList.length > 0)
    initNoticeNum = req.user.noticeList[0].id;


  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = req.user.token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['cate_id'] = cateId || initNoticeNum;
  bindVal['p'] = pageNum || 1;
  bindVal['limit'] = limit || 10;
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_NOTICE_RECORD, bindVal, function (err, result) {
      if(err) {
        reject(err)
      } else if(result.status == 10000) {
        common.sendResultForm(UMS_API_HOST + API_NOTICE_RECORD, bindVal, result)
        resolve(result.data);
      } else {
        resolve('');
      }
    });
  });
}

/* 다국어 목록 */
function getLangList (token) {

  let bindVal = {};
  bindVal['merchant_id'] = global.merchant_id;
  bindVal['token'] = token;
  bindVal['timestamp'] = new Date().getTime();
  bindVal['sign'] = common.sign(bindVal, global.merchant_key);

  return new Promise(function(resolve, reject){  
    agent.callApi('post', API_LANGUAGE, bindVal, function (err, result) {
      if(err) {
        reject(err)
      } else if(result.status == 10000) {
        common.sendResultForm(UMS_API_HOST + API_LANGUAGE, bindVal, result)
        resolve(result.data);
      } else {
        resolve('');
      }
    });
  });
}


module.exports = router;
