var express = require('express');
var router = express.Router();
var global = require('./global.json');
var errMsg = require('./error_msg.json');
var agent = require('../public/util/api_call.js');
var common = require('../public/util/common.js');
var config = require('../config/config.json')
var Promise = require('bluebird');

const UMS_API_HOST = config.api_host;
const API_SUGGEST_RECORD = '/userapi/suggest_record';   // 문의 및 제안 목록 조회
const API_SUGGEST = '/userapi/suggest';                 // 문의 및 제안 목록 쓰기

/***************************************************
# prepix : /suggest
***************************************************/

router.get('/suggestion', common.ensureAuth, function(req, res, next) {

    let sug_list = [];
    let result = {};

    Promise.try(function() {
        return getSuggestList(req.user.token)
    }).then(function(data) {
        result.page = data.page || 1;
        result.total_pages = data.total_pages || 1;
        result.total_nums = data.total_nums || 0;
        sug_list = data.list || [];
        res.render('suggest/suggestion', { 
            title: '문의/건의',
            sess: req.user,
            page: result.page,
            totalPages: result.total_pages,
            totalNum: result.total_nums,
            suggestList: sug_list
        });
    }).catch(function(err){
        console.log(err)
        res.render('suggest/suggestion', { 
            title: '문의/건의',
            sess:req.user
        });
    })
});

router.get('/suggestion_add', common.ensureAuth, function(req, res, next) {
    res.render('suggest/suggestion_add', 
        { 
            title: '문의/건의',
            sess:req.user,
            prePageUrl: '/suggest/suggestion'
        }
    );
});

/* 문의글 쓰기 */
router.post('/ajax/suggestion_add', common.ensureAuth, function(req, res, next) {
    let params = {};
    params.token = req.user.token;
    params.content = req.body.content || '';
    params.pic = req.body.pic || '';

    Promise.try(function(){
        return writeSuggestion(params)
    }).then(function(data) {
            res.json({
            status: '_success_',
            url: '/suggest/suggestion'
        })
    }).catch(function(err){
            res.json({
            status:'_error_',
            msg: 'API 통신 에러'
        })
    })
});

//////////////////////////////////////////////////////////////////////////////////////////
// ajax
//////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////
// function
//////////////////////////////////////////////////////////////////////////////////////////

/* 문의 및 제안 목록 조회 */
function getSuggestList (token, page, status, limit) {
    let bindVal = {};
    bindVal['merchant_id'] = global.merchant_id;
    bindVal['token'] = token;
    bindVal['timestamp'] = new Date().getTime();
    bindVal['p'] = page || 1;
    bindVal['status'] = status || 0; // 1:답변완료, 2:답변대기, 0:모두 
    bindVal['limit'] = limit || 10;
    bindVal['sign'] = common.sign(bindVal, global.merchant_key);

    console.log(bindVal)
    return new Promise(function(resolve, reject){  
        agent.callApi('post', API_SUGGEST_RECORD, bindVal, function (err, result) {
            if(err) {
                reject(err)
            } else if(result.status == 10000) {
                common.sendResultForm(UMS_API_HOST + API_SUGGEST_RECORD, bindVal, result)
                resolve(result.data);
            } else {
            resolve('');
            }
        });
    });
}

/* 문의 및 제안 쓰기 */
function writeSuggestion(obj) {
    let bindVal = {};
    bindVal['merchant_id'] = global.merchant_id;
    bindVal['token'] = obj.token;
    bindVal['timestamp'] = new Date().getTime();    // 중국하고 1시간 차이 발생
    bindVal['content'] = obj.content;
    bindVal['pic'] = obj.pic;
    bindVal['sign'] = common.sign(bindVal, global.merchant_key);

    console.log(bindVal)
    return new Promise(function(resolve, reject){  
        agent.callApi('post', API_SUGGEST, bindVal, function (err, result) {
            if(err) {
                reject(err)
            } else if(result.status == 10000) {
                common.sendResultForm(UMS_API_HOST + API_SUGGEST, bindVal, result)
                resolve(result.data);
            } else {
            resolve('');
            }
        });
    });
}

function editSuggestList(arr) {
    return new Promise(function(resolve, reject){  
        console.log(arr)
        const sortField = "id"
        arr.sort(function(a, b) {
            return a[sortField] - b[sortField];
        })
        resolve(arr)
    })
}

module.exports = router;
