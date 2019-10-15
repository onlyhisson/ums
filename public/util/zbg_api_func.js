
/**********************************************************************************
 * ZBG 거래소 API 키값이 필요한 함수
 * URL : https://www.zbg.com/help/httpApi 
**********************************************************************************/

const agent = require('./api_call.js');
const common = require('./common.js');

const EXC_GETBYWEBID = '/exchange/config/controller/website/marketcontroller/getByWebId'; // 마켓목록 얻기
const EXC_GETUSERINFO = '/exchange/user/controller/website/usercontroller/getuserinfo'; // 사용자 정보
const EXC_ADDENTRUST = '/exchange/entrust/controller/website/EntrustController/addEntrust'; // 매도매수주문
const EXC_GETUSERENTRUSTRECORD_FROMCACHE = '/exchange/entrust/controller/website/EntrustController/getUserEntrustRecordFromCache'; // 진행 중인 주문 조회
const EXC_GETUSERENTRUSTLIST = '/exchange/entrust/controller/website/EntrustController/getUserEntrustList'; // 조회 기록 위탁 주문 페이징
const EXC_GETPAYINADDRESS = '/exchange/fund/controller/website/fundcontroller/getPayinAddress'; // 입금 주소 조회
const EXC_GETPAYINCONINRECORD = '/exchange/fund/controller/website/fundcontroller/getPayinCoinRecord'; // 입금 내역 조회
const EXC_GETPAYOUTCOINRECORD = '/exchange/fund/controller/website/fundwebsitecontroller/getpayoutcoinrecord'; // 출금 내역 조회
const EXC_FINDBYPAGE = '/exchange/fund/controller/website/fundcontroller/findbypage'; // 모든 자산정보 획득

/* ZBG 거래소 API 키값 조회 */
exports.getZbgSecretKey = function (id) {
	let qry = ` SELECT	 ` +
				`   zbg_api_id AS apiid, ` +
				`   zbg_api_key AS apikey, ` +
				`   status ` +
				` FROM	ums.users `  +
				` WHERE	id="${id}"; `
	return new Promise(function(resolve, reject){ 
		common.exeQuery(qry, function(err, result){
		if(err)
			reject(err)

		resolve(result)
		})
	})
}

/* 
* 1.1 마켓 목록 얻기 (ZBG 거래소 화폐별 데이터) 
* @param obj    : api keys
*/
exports.coinMappingData = function (obj) {

    let bindVal = {}

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('post', obj, EXC_GETBYWEBID, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                //common.sendResultForm2(EXC_GETBYWEBID, bindVal, result.datas.list)
                resolve(result.datas)
            }
        });
    })
}

/* 
* 2.1 사용자 정보 인터페이스 얻기
* @param obj    : api keys
*/
exports.getUserInfo = function (obj) {

    let bindVal = {}

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('post', obj, EXC_GETUSERINFO, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                //common.sendResultForm2(EXC_GETUSERINFO, bindVal, result.datas.list)
                resolve(result)
            }
        });
    })
}

/* 
* 3.1 새 대리자 (ZBG 거래소 매도 매수 주문) - fail code:6899
* @param obj        : api keys
* @param amount     : 주문 금액
* @param rangeType  : 위탁 주문 유형 현재 가격의 수수료만 지원 (0: 현재 가격의 수수료 1: 범위 수수료)
* @param type       : 거래 유형 (0: 판매 1: 구매)
* @param marketName : 마켓 이름
* @param price      : 가격
*/
exports.addEntrust = function (obj, sendData) {

    let bindVal = {}
    bindVal['amount']       = sendData.amount;
    bindVal['rangeType']    = sendData.rangeType || 0;
    bindVal['type']         = sendData.type;
    bindVal['marketName']   = sendData.marketName;
    bindVal['price']        = sendData.price;

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('post', obj, EXC_ADDENTRUST, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                common.sendResultForm2(EXC_ADDENTRUST, bindVal, result)
                resolve(result)
            }   
        });
    })
}

/* 
* 3.4 진행 중인 인수 문의 - fail code:6899
* @param obj        : api keys
* @param marketName : 마켓 이름 ex) whc_usdt
*/
exports.getUserEntrustRecordFromCache = function (obj, marketName) {

    let bindVal = {}
    bindVal['marketName'] = marketName;

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('get', obj, EXC_GETUSERENTRUSTRECORD_FROMCACHE, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                common.sendResultForm2(EXC_GETUSERENTRUSTRECORD_FROMCACHE, bindVal, result)
                resolve(result)
            }   
        });
    })
}

/* 
* 3.5 조회 기록 위탁 주문 페이징 - fail code:6899
* @param obj        : api keys
* @param marketName : 마켓 이름 ex) whc_usdt
* @param pageIndex  : 페이지
* @param pageSize   : 페이지당 표시 항목 수
* @param type       : 주문 유형(0:sell, 1:buy, -1:cancel)
* @param status     : 주문 상태(-2:unfreezing failed, -1:insufficient, 1:cancel, 2:successful, 3:part of transaction, 4:canceling)
* @param startDateTime  : 조회 시작 시
* @param endDateTime    : 조회 종료 시
*/
exports.getUserEntrustList = function (obj, sendData) {

    let bindVal = {}
    bindVal['marketName']   = sendData.marketName || 'whc_usdt';
    bindVal['pageIndex']    = sendData.pageIndex || 1;
    bindVal['pageSize']     = sendData.pageSize || 20;
    bindVal['type']         = sendData.type; // 0:sell, 1:buy, -1:cancel
    bindVal['status']       = sendData.status || 2; // -2:unfreezing failed, -1:insufficient, 1:cancel, 2:successful, 3:part of transaction, 4:canceling
    bindVal['startDateTime']    = sendData.startDateTime || +new Date() - 1000*60*60*24;
    bindVal['endDateTime']      = sendData.endDateTime || +new Date();
 
    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('get', obj, EXC_GETUSERENTRUSTLIST, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                common.sendResultForm2(EXC_GETUSERENTRUSTLIST, bindVal, result)
                resolve(result)
            } 
        });
    });
}

/* 
* 4.1 입금 주소 얻기
* @param obj : api keys
* @param currencyTypeName : 통화 유형 이름(필수; ex. "btc") 
*/
exports.getPayinAddress = function (obj, curName) {

    let bindVal = {}
    bindVal['currencyTypeName']   = curName || 'whc';

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('post', obj, EXC_GETPAYINADDRESS, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                common.sendResultForm2(EXC_GETPAYINADDRESS, bindVal, result)
                resolve(result)
            }
        });
    })
}

/* 
* 4.2 입금 내역 조회
* @param obj : api keys
* @param currencyTypeName : 통화 유형 이름(필수; ex. "btc") 
* @param sort : no-param : reverse chronological order, param : chronological order
* @param pageNum : 
* @param pageSize :
*/
exports.getPayinCoinRecord = function (obj, sendData) {

    let bindVal = {}
    bindVal['currencyTypeName'] = sendData.curName || 'whc';
    bindVal['sort']             = sendData.sort || 1;
    bindVal['pageNum']          = sendData.pageNum || 1;
    bindVal['pageSize']         = sendData.pageSize || 20;

    let statusType = {
        0 : 'not arrive yet',
        1 : 'already arrived'
    }

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('post', obj, EXC_GETPAYINCONINRECORD, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                let editResult = result;
                editResult['statusType'] = statusType;
                common.sendResultForm2(EXC_GETPAYINCONINRECORD, bindVal, result)
                resolve(editResult)
            }
        });
    })
}

/* 
* 4.3 출금 내역 조회
* @param obj : api keys
* @param currencyId : 통화 유형 ID, 필수
* @param tab : all, wait(submitted，not verify yet), success(verified), fail(failed), cancel(user cancel), 필수
* @param pageIndex : default 1, selectable
* @param pageSize : default 10, selectable
*/
exports.getPayoutCoinRecord = function (obj, sendData) {

    let bindVal = {}
    bindVal['currencyId']   = sendData.currencyId || 175; // 175:whc
    bindVal['tab']          = sendData.tab || 'all';
    bindVal['pageIndex']    = sendData.pageIndex || 1;
    bindVal['pageSize']     = sendData.pageSize || 10;

    let statusTypeOut = {
        '-1' : 'cancelled',
        '1' : 'normal'
    }

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('get', obj, EXC_GETPAYOUTCOINRECORD, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                let editResult = result;
                editResult['statusTypeOut'] = statusTypeOut;
                common.sendResultForm2(EXC_GETPAYOUTCOINRECORD, bindVal, result)
                resolve(editResult)
            }
        });
    })
}

/* 
* 4.4 Acquire All Assets Information (ZBG 거래소 모든 자산 정보) 
* @param obj    : api keys
* @param pSize  : row in each page（selectable）
* @param pNum   : page number（selectable）
*/
exports.getAssestInfo = function (obj, pSize, pNum) {

    let bindVal = {}
    bindVal['pageSize'] = pSize || 30;  // 
    bindVal['pageNum'] = pNum || 1;     // 

    return new Promise(function(resolve, reject){ 
        agent.zbgApi2('post', obj, EXC_FINDBYPAGE, bindVal, function (err, result) {
            if(err) {
                console.log(err)
                reject(err)
            } else {
                //common.sendResultForm2(EXC_FINDBYPAGE, bindVal, result.datas.list)
                resolve(result)
            }
        });
    })
}
