var createError = require('http-errors');
var express = require('express');
var path = require('path');
var app = express();
var session = require('express-session');
var logger = require('morgan');
var config = require('./config/config.json')
//var winston_log = require('./public/common/log_winston');

var passport = require('passport');						// 로그인 처리
var passportConfig = require('./public/util/passport');	// 로그인 처리

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');	// form tag post 방식에서는 post형식이므로 body를 탐색하기 위해 필요

// flash 라는 세션 객체 영역에 임시 메시지를 저장하게 만드는 노드 모듈
var flash = require('connect-flash')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var depositRouter = require('./routes/deposit');
var suggestRouter = require('./routes/suggest');
var zbgRouter = require('./routes/zbg');
//var loginRouter = require('./routes/login');

// view 폴더들과 엔진을 설정
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

/* 'default', 'short', 'tiny', 'dev' */
//app.use(logger('short'));

/* 파일 버퍼 제한사항 */
app.use(bodyParser.json({limit: '50mb'}));	// for parsing application/json
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' })); // for parsing application/x-www-form-urlencoded

var sess = {
	key: config.session_key,	// 세션키
  	secret: config.secret_key,	// 비밀키
	cookie: {
		maxAge: 1000*60*60,		// 쿠키 유효기간 1시간
	},
	resave: false,			// 세션 아이디를 접속할 때마다 새로 발급하지 않는다.
	rolling: true,
	saveUninitialized: true	// 세션 아이디를 실제 사용하기 전에는 발급하지 않는다.
}

app.use(session(sess));			// 세션 활성화

app.use(flash());
app.use(passport.initialize()); // passport 구동
app.use(passport.session()); 	// 세션 연결
passportConfig()

app.use(cookieParser());
app.use('/public', express.static(__dirname + '/public',{}));
app.use('/assets', express.static(__dirname + '/public/assets2',{}));
app.use('/assets2', express.static(__dirname + '/public/assets2',{}));
app.use('/images', express.static(__dirname + '/public/assets2/images',{}));
app.use('/images2', express.static(__dirname + '/public/assets2/images',{}));
app.use('/pdf', express.static(__dirname + '/public/assets2/pdf',{}));
//app.use('/modules', express.static(__dirname + '/node_modules',{}));

app.disable('view cache');

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/deposit', depositRouter);
app.use('/suggest', suggestRouter);
app.use('/zbg', zbgRouter);
//app.use('/login', loginRouter);

/* server Listen */
app.listen(config.port, function(){  //Apache 에서 Virtual 설정
	console.log("Working on port "+ config.port);
})

// catch 404 and forward to error handler
app.use(function(err, req, res, next) {
  next(createError(404));
});

//The 404 Route (ALWAYS Keep this as the last route)
//app.get('*', function(req, res){
app.use((req, res, next) => {
	res.render('error', {
		message:'요청하신 페이지를 찾을 수 없습니다.',
		code:'404'
	});
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	let err_code = err.status || 500;
	res.status(err_code);
	res.render('error', {
		message:err.message,
		code:err_code
	});
});

module.exports = app;
