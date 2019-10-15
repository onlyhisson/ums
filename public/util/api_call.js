const request = require('request');
const querystring = require('querystring');
const md5 = require('md5');
const config = require('../../config/config.json');
let common = require('./common.js') 


exports.callApi = function (method, uri, bindVal, callback) {
    //var PORT = ':' + config.agent_port;
    let HOST = config.api_host
    let BASE_PATH = '';
    let OPTIONS = {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        url: null,
        body: null,
        query : null
    };

    //OPTIONS.url = HOST + PORT + BASE_PATH + uri;
    OPTIONS.url = HOST + BASE_PATH + uri;

    if (method === 'get') {
        var url_qs = querystring.stringify(bindVal);
        request.get(OPTIONS.url + '?' + url_qs, function (err, res, result) {
            try {
                statusCodeErrorHandler(res.statusCode, callback, result);
            } catch (e) {
                console.log(e);
                return callback('error', {e});
            }
        });
    } else if (method === 'post') {
        //OPTIONS.body = JSON.stringify(bind_val);
        OPTIONS.body = querystring.stringify(bindVal);
        request.post(OPTIONS, function (err, res, result) {
            try {
                statusCodeErrorHandler(res.statusCode, callback, result);
            } catch (e) {
                console.log(e);
                return callback('error', {e});
            }
        });
    } else {

    }

    return callback;
}

exports.zbgApi = function (method, uri, bindVal, callback) {
    //var PORT = ':' + config.agent_port;
    let HOST = config.zbg_host
    let BASE_PATH = '';
    let OPTIONS = {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        url: null,
        body: null,
        query : null
    };

    //OPTIONS.url = HOST + PORT + BASE_PATH + uri;
    OPTIONS.url = HOST + BASE_PATH + uri;

    if (method === 'get') {
        var url_qs = querystring.stringify(bindVal);
        request.get(OPTIONS.url + '?' + url_qs, function (err, res, result) {
            try {
                statusCodeErrorHandler(res.statusCode, callback, result);
            } catch (e) {
                console.log(e);
                return callback('error', {e});
            }
        });
    } else if (method === 'post') {
        //OPTIONS.body = JSON.stringify(bind_val);
        OPTIONS.body = querystring.stringify(bindVal);
        request.post(OPTIONS, function (err, res, result) {
            try {
                statusCodeErrorHandler(res.statusCode, callback, result);
            } catch (e) {
                console.log(e);
                return callback('error', {e});
            }
        });
    } else {

    }

    return callback;
}

exports.zbgApi2 = function (method, keyObj, uri, bindVal, callback) {

    let ACCESS_KEY = keyObj.apiid || "";
    let SECRET_KEY = keyObj.apikey || "";
    let timeStamp = +new Date();
    let params = '';

    //let PORT = ':' + config.agent_port;
    let HOST = 'https://www.zbg.com'
    let BASE_PATH = '';
    let OPTIONS = {
        headers: {
            'Apiid': ACCESS_KEY,
            'Timestamp': timeStamp,
        },
        url: null,
        body: null,
        query : null
    };

    OPTIONS.url = HOST + /* PORT + */BASE_PATH + uri;

    if (method === 'get') {
        let tempObj = {};

        // key를 기준으로 오름차순으로 정렬
        Object.keys(bindVal).sort().forEach(function(key) {
            tempObj[key] = bindVal[key];
        });

        // params = key1+value1+key2+value2+...
        for(key in tempObj) {
            params += key+bindVal[key]
        }
        /*
        console.log('-------------------------------')
        console.log(ACCESS_KEY)
        console.log(timeStamp)
        console.log(md5(ACCESS_KEY + timeStamp + params + SECRET_KEY))
        console.log('-------------------------------')
        */
        OPTIONS.headers['Sign'] = md5(ACCESS_KEY + timeStamp + params + SECRET_KEY);
        OPTIONS.url += '?'+querystring.stringify(bindVal)

        request.get(OPTIONS, function (err, res, result) {
            try {
                statusCodeErrorHandler(res.statusCode, callback, result);
            } catch (e) {
                console.log(e);
                return callback('error', {e});
            }
        });
    } else if (method === 'post') {
        params = JSON.stringify(bindVal);
        /*
        console.log('-------------------------------')
        console.log(ACCESS_KEY)
        console.log(timeStamp)
        console.log(md5(ACCESS_KEY + timeStamp + params + SECRET_KEY))
        console.log('-------------------------------')
        */
        OPTIONS.headers['Content-Type'] = 'application/json';
        OPTIONS.headers['Sign'] = md5(ACCESS_KEY + timeStamp + params + SECRET_KEY);
        OPTIONS.body = params;
        //OPTIONS.body = querystring.stringify(bindVal);
        request.post(OPTIONS, function (err, res, result) {
            if(err)
                return callback('error', {err});

            try {
                statusCodeErrorHandler(res.statusCode, callback, result);
            } catch (e) {
                console.log(e);
                return callback('error', {e});
            }
        });
    } else {

    }

    return callback;
}


/**************************************************************
 * function
 **************************************************************/

// 에러 핸들링
function statusCodeErrorHandler(statusCode, callback , data) {
    /*
    200 성공
    400 Bad Request - field validation 실패시
    401 Unauthorized - API 인증,인가 실패
    404 Not found ? 해당 리소스가 없음
    500 Internal Server Error - 서버 에러
    */
    // console.log('###############################################');
    // console.log('# status_message : ' + statusCode);
    // console.log('# ' + data);
    // console.log('###############################################');
  
    switch (statusCode) {
        case 200:
            callback(null, JSON.parse(data));
            break;
        default:
            callback('error', JSON.parse(data));
            break;
    }
  }
  