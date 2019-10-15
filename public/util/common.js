var md5 = require("md5");
var mysql = require("mysql");
var config = require('../../config/config.json');
var db_config = require('../../config/db_config.json');
var global = require('../../routes/global.json')
var multer = require('multer'); 
var fs = require('fs'); 
var request = require('request'); 
var path = require('path'); 
var errMsg = require('../../routes/error_msg.json')
var connection;

const API_UPLOAD = '/userapi/upload';

handleDisconnect();

// sign 키값의 value 리턴
exports.sign = function (jsonData, apiKey) {

	let str = "";
	let ordered = {};

	Object.keys(jsonData).sort().forEach(function(key) {
		ordered[key] = jsonData[key];
	});

	for(key in ordered) {
		str += key+"="+ordered[key]+"&"
	}

	return md5(str+"key="+apiKey).toUpperCase();
}

// 로그인 인증 함수
exports.ensureAuth = function (req, res, next) {
	if(req.isAuthenticated()){
		//res.redirect('/index')
		return next()
	} else {
		res.render('login')
	}
}

// MASTER_DB 쿼리 실행 함수
exports.exeQuery = function (qry, callback) {
	connection.query(qry, function(err, results){
		if(db_config.db_query === "Y")
			console.log(qry);
		if (err)
			callback(err, null);
		else
			callback(null, results);
	});
};

/* 문의 내용 이미지 웹서버 저장 */
exports.saveImage = function (req, res) {
	/* multar 에러 코드 */
	const multarErr = {
		'LIMIT_PART_COUNT': 'Too many parts',
		'LIMIT_FILE_SIZE': '해당 파일의 크기가 큽니다(3Mb 이하)',
		'LIMIT_FILE_COUNT': '파일의 개수가 많습니다.',
		'LIMIT_FIELD_KEY': '필드명이 너무 깁니다.',
		'LIMIT_FIELD_VALUE': '필드값이 너무 깁니다.',
		'LIMIT_FIELD_COUNT': '필드가 너무 많습니다.',
		'LIMIT_UNEXPECTED_FILE': '예기치 않은 필드입니다.'
	}

	return new Promise(function(resolve, reject){

		var exts = ['jpg', 'gif', 'png', 'jpeg','pdf'];    // 이미지 확장자 검증
		var storage = multer.diskStorage({
			
			destination: function (req, file, callback) {   // cb 콜백함수를 통해 전송된 파일 저장 디렉토리 설정
				callback(null, config.local_img_path);
			},
			filename: function (req, file, callback) {      // cb 콜백함수를 통해 전송된 파일 이름 설정
				//file_name = new Date().valueOf() + path.extname(file.originalname);
				file_ext = path.extname(file.originalname);

				// 이미지 파일 외에는 파일저장하기 전에 return
				if(!exts.includes(file_ext.substring(1).toLowerCase())){
					reject({
						status:'_error_',
						msg: '업로드 파일 형식 에러'
					});
				}else{
					callback(null, file.originalname);
				}
			}
		});

		var upload = multer({ 
			storage: storage,
			limits: {
				fileSize: Number(config.file_size)	// 3M
			} 
		}).single('Fichier1');

		upload(req, res, function (err) {
			if(err) {
				let editErr = {}
				editErr.name = err.name				// MulterError
				editErr.msg = multarErr[err.code]	// File too large
				editErr.code = err.message			// LIMIT_FILE_SIZE
				reject(editErr);
			} else {
				resolve({
					status:'_success_',
					fileName: req.file.originalname
				});
			}
		})
	})
}

/* 문의 내용 이미지 업로드(API 서버에 전송) */

exports.uploadApi = function (token, fileName) {

	let bindVal = {};
	bindVal['merchant_id'] = global.merchant_id;
	bindVal['token'] = token;
	bindVal['timestamp'] = new Date().getTime();
	//bindVal['file'] = fs.createReadStream(__dirname + '/../public/assets/images/testimage.jpg');
	//bindVal['sign'] = common.sign(bindVal, global.merchant_key);

	console.log(bindVal)

	return new Promise(function(resolve, reject){
		//let upfile = __dirname + '/../public/assets/images/testimage.jpg';
		let upfile = config.local_img_path + '/' + fileName;
		let reqTime = new Date().getTime();
		fs.readFile(upfile, function(err, content){
			if(err){
				console.error(err);
				reject(err)
			}
			var metadata = {
				merchant_id: global.merchant_id,
				token: token,
				timestamp: reqTime
			};
			var url = config.api_host + API_UPLOAD;
			var boundary = "xxxxxxxxxx";
			var data = "";
			for(var i in metadata) {
				if ({}.hasOwnProperty.call(metadata, i)) {
					data += "--" + boundary + "\r\n";
					data += "Content-Disposition: form-data; name=\"" + i + "\"; \r\n\r\n" + metadata[i] + "\r\n";
				}
			};
			data += "--" + boundary + "\r\n";
			data += "Content-Disposition: form-data; name=\"file\"; filename=\"" + upfile + "\"\r\n";
			data += "Content-Type:application/octet-stream\r\n\r\n";
			var payload = Buffer.concat([
					Buffer.from(data, "utf8"),
					new Buffer(content, 'binary'),
					Buffer.from("\r\n--" + boundary + "\r\n", "utf8"),
			]);
			var options = {
				method: 'post',
				url: url,
				headers: {"Content-Type": "multipart/form-data; boundary=" + boundary},
				body: payload,
			};
			request(options, function(error, response, body) {
				let bodyParse = JSON.parse(body)

				console.log('##################### [ Image Upload Response Start] #####################')
				console.log(bodyParse.status);  // 10000
				console.log(errMsg[bodyParse.status]);     // ''
				console.log(bodyParse.data);    //{ url: '/uploads/201909/5d806a1aa4f6e.jpg' }
				console.log('##################### [ Image Upload Response End]   #####################')
				
				if(err) {
					reject(err)
				} else if (bodyParse.status == 10000) {
					resolve(bodyParse.data)
				} else {
					resolve()
				}
			});
		});

	});
}

/* 이미지 파일을 api 서버에 전송 후 local에는 제거 */
exports.deleteFile = function (fileName) {
	return new Promise(function(resolve, reject){
		let fileFullName = config.local_img_path + '/' + fileName;
		fs.unlink(fileFullName, function(err){
			if(err) {
				console.log(err)
				reject({
					status: '_error_'
				})
			} else {
				console.log('the file deleted after api server uploaded')
				resolve()
			}
		});
	})
};

// ZBG
exports.formatdateBasic = function (sDate, num) {
	let d = new Date(sDate*1000);

	if(num)
		d.setHours(d.getHours() + num) // 시간 오차 수정

	yy = d.getFullYear();
	mm = d.getMonth() + 1; mm = (mm < 10) ? '0' + mm : mm;
	dd = d.getDate(); dd = (dd < 10) ? '0' + dd : dd;
	hh = d.getHours(); hh = (hh < 10) ? '0' + hh : hh;
	mi = d.getMinutes(); mi = (mi < 10) ? '0' + mi : mi;
	se = d.getSeconds(); se = (se < 10) ? '0' + se : se;
	
	return '' /*+ yy + '-' +  mm  + '-' + dd + ' '*/ + hh + ':' + mi + ':' + se;
};

exports.formatdateBasic2 = function (sDate) {
	let d = new Date(sDate);
	d.setHours(d.getHours() + 13)	// 시간 오차 수정

	hh = d.getHours(); hh = (hh < 10) ? '0' + hh : hh;
	mi = d.getMinutes(); mi = (mi < 10) ? '0' + mi : mi;
	se = d.getSeconds(); se = (se < 10) ? '0' + se : se;
	
	return '' + hh + ':' + mi + ':' + se;
};

exports.formatdateBasic3 = function (sDate) {

	let d = new Date();
	if(sDate)
		d = new Date(sDate);
	d.setHours(d.getHours() + 12)	// 시간 오차 수정

	yy = d.getFullYear();
	mm = d.getMonth() + 1; mm = (mm < 10) ? '0' + mm : mm;
	dd = d.getDate(); dd = (dd < 10) ? '0' + dd : dd;
	hh = d.getHours(); hh = (hh < 10) ? '0' + hh : hh;
	mi = d.getMinutes(); mi = (mi < 10) ? '0' + mi : mi;
	se = d.getSeconds(); se = (se < 10) ? '0' + se : se;
	
	return '' + yy + '-' +  mm  + '-' + dd + ' ' + hh + ':' + mi + ':' + se;
};

/* UMS 전송 응답 데이터 log */
exports.sendResultForm = function (url, sendData, result) {
	if(config.ums_log_yn == "Y") {
		console.log('[ START ] ################################')
		console.log(' * REQUST API PATH : ' + url)
		console.log(' * REQUST TIME : ' + this.formatdateBasic3())
		console.log(' * REQUST DATA FORM : ')
		console.log(sendData)
		console.log(' * RESPONSE ')
		console.log(result)
		console.log(' * API Server Message  : ' + errMsg[result.status])
		console.log('[ END ] ##################################')
	}
}

/* ZBG 전송 응답 데이터 log */
exports.sendResultForm2 = function (url, sendData, result) {
	if(config.zbg_log_yn == "Y") {
		console.log('[ START ] ################################')
		console.log(' * REQUST API PATH : ' + url)
		console.log(' * REQUST TIME : ' + this.formatdateBasic3())
		console.log(' * REQUST DATA FORM : ')
		console.log(sendData)
		console.log(' * RESPONSE ')
		console.log(result)
		console.log(' * API Server Message  : ' + result.resMsg.message)
		console.log('[ END ] ##################################')
	}
}

function handleDisconnect() {
	// Recreate the connection, since The server is either down or restarting
	// (takes a while sometimes).
	connection = mysql.createConnection(db_config);

	// We introduce a delay before attempting to reconnect,
	// to avoid a hot loop, and to allow our node script to
	// process asynchronous requests in the meantime.
  // If you're also serving http, display a 503 error.
	connection.connect(function(err) {
		if(err) {
			console.log('error when connecting to db:', err);
			setTimeout(handleDisconnect, 2000);
		}else{
			console.log('DB Connected');
		}
	});

  // Connection to the MySQL server is usually lost due to either server restart,
	// or a connnection idle timeout (the wait_timeout server variable configures this)
	connection.on('error', function(err) {
		console.log('db error', err);
		if(err.code === 'PROTOCOL_CONNECTION_LOST') {
			handleDisconnect();
		} else {
			throw err;
		}
	});
};

