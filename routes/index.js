var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


// from example
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var AWS = require('aws-sdk');
var colors = require('colors');

var AWS_ACCOUNT_ID = 'XXXXXXXXXXX';
var AWS_Region = 'us-east-1';
var COGNITO_IDENTITY_POOL_ID = 'us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxx';
var COGNITO_IDENTITY_ID, COGNITO_SYNC_TOKEN, AWS_TEMP_CREDENTIALS;
var cognitosync;
var IAM_ROLE_ARN = 'arn:aws:iam::xxxxxxxxxx:role/Cognito_AWSCognitoTutorialAuth_DefaultRole';
var COGNITO_SYNC_COUNT;
var COGNITO_DATASET_NAME = 'TEST_DATASET';
var FACEBOOK_APP_ID = 'xxxxxxxxxxxx';
var FACEBOOK_APP_SECRET = 'xxxxxxxxxxxxxxxxxxxxxxxxxxx';
var FACEBOOK_TOKEN;
var FACEBOOK_USER = {
  id: '',
  first_name: '',
  gender: '',
  last_name: '',
  link: '',
  locale: '',
  name: '',
  timezone: 0,
  updated_time: '',
  verified: false
};
var userLoggedIn = false;

router.use(passport.initialize());
router.use(passport.session());

passport.use(new FacebookStrategy({
  clientID: FACEBOOK_APP_ID,
  clientSecret: FACEBOOK_APP_SECRET,
  callbackURL: 'http://localhost:8080/auth/facebook/callback'
}, function(accessToken, refreshToken, profile, done) {
  process.nextTick(function() {
    FACEBOOK_TOKEN = accessToken;
    FACEBOOK_USER = profile._json;
    userLoggedIn = true;
    done(null, profile);
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});
// /from example


/* GET Facebook page. */
router.get('/auth/facebook', passport.authenticate('facebook'));

/* GET Facebook callback page. */
router.get('/auth/facebook/callback', passport.authenticate('facebook', {
  successRedirect: '/success',
  failureRedirect: '/error'
}));

/* GET Facebook success page. */
router.get('/success', function(req, res, next) {
  console.log('FACEBOOK_TOKEN:'.green + FACEBOOK_TOKEN);
  getCognitoID();
  res.send('Logged in as ' + FACEBOOK_USER.name + ' (id:' + FACEBOOK_USER.id + ').');
});

router.route('/sync')
  .put(function(req, res) {
    res.json({ message: 'Sync Put Started' });
  })
  .get(function(req, res) {

  });

/* GET Facebook error page. */
router.get('/error', function(req, res, next) {
  res.send("Unable to access Facebook servers. Please check internet connection or try again later.");
});

module.exports = router;
