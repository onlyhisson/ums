var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var errMsg = require('../../routes/error_msg.json')
var global = require('../../routes/global.json')
var common = require('./common.js');
var agent = require('./api_call.js');

module.exports = () => {
  // user 인스턴스(req.session.passport.user)에 세션을 직렬화 저장
  passport.serializeUser(function(user, done) {
    done(null, user);
  });
  // 인증후, user 인스턴스를 세션으로부터 읽어서 request.user에 저장
  // 서버로 들어오는 요청마다 세션 정보를 DB의 데이터와 비교, 현재는 처리과정X
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });
  
  
  passport.use(new LocalStrategy(
    { //local 전략을 세움
      usernameField: 'uid',
      passwordField: 'upass',
      session: true, // 세션에 저장 여부
      passReqToCallback:  true,	// req에 user 데이터 포함여부
    },
    function(req, uid, upass, done) { // => passReqToCallback : true 일 때 콜백 형태
      
      let successCode = [10000, 10005]
      let bindVal = {};
      bindVal['merchant_id'] = global.merchant_id;
      bindVal['email'] = uid;
      bindVal['pwd'] = upass;
      bindVal['timestamp'] = new Date().getTime();
      bindVal['sign'] = common.sign(bindVal, global.merchant_key);


      agent.callApi('post', '/userapi/login', bindVal, function (err, result, callback) {

        if(err) {
          console.log(err)
          return done(null, false, req.flash('loginError','Error API Server'));
        }

        console.log('Loin===================================')
        console.log(result)
        console.log('[API Server Message] : ' + result.status +' '+ errMsg[result.status])
        console.log('Loin===================================')

        if(successCode.includes(result.status)) {
          var user = {
            'loginType':'LOCAL',
            'email':result.data.email,
            'cardList':result.data.card_list,
            'is_kyc':result.data.is_kyc,
            'username':result.data.username,
            'first_name':result.data.first_name,
            'last_name':result.data.last_name,
            'token':result.data.token
          };

          return done(null, user);  // serializeUser 로 user 객체 전달
        } else {
          return done(null, false, req.flash('loginFailed', {status: result.status, msg: result.msg}));
        }
      });

    }
  ));

/*
  passport.use(new LocalStrategy(
    { //local 전략을 세움
      usernameField: 'uid',
      passwordField: 'upass',
      session: true, // 세션에 저장 여부
      passReqToCallback:  true,	// req에 user 데이터 포함여부
    },
    function(req, uid, upass, done) { // => passReqToCallback : true 일 때 콜백 형태
      
      var user = {
        'loginType':'LOCAL',
        'email': 'temp@email.com',
        'cardList': global.cardList,
        'token': 'TOKEN'
      };

      return done(null, user);

    }
  ));
*/
}

