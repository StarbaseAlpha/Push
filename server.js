'use strict';

const express = require('express');
const router = express.Router();
const webpush = require('web-push');

function Push(email=null, publicKey=null, privateKey=null) {

  const setDetails = (email, publicKey, privateKey) => {
    let address = email;
    if (address.slice(0,7).toLowerCase() !== 'mailto:') {
      address = 'mailto:' + address;
    }
    webpush.setVapidDetails(address, publicKey, privateKey);
  };

  if (email && publicKey && privateKey) {
    setDetails(email, publicKey, privateKey);
  }

  const generateKeys = () => {
    return webpush.generateVAPIDKeys();
  };

  let subscribeHandler = null;
  const onSubscribe = (cb) => {
    subscribeHandler = cb;
  };

  let unsubscribeHandler = null;
  const onUnsubscribe = (cb) => {
    unsubscribeHandler = cb;
  };

  router.post('/subscribe', async (req, res, next) => {
    let {subscription, token} = req.body;
    if (subscription && subscription.keys && subscription.keys.auth && subscribeHandler && typeof subscribeHandler === 'function') {
      await subscribeHandler({subscription, token});
    }
    res.json({"subscribe":true});
  });

  router.post('/unsubscribe', async (req, res, next) => {
    let {subscription, token} = req.body;
    if (subscription && subscription.keys && subscription.keys.auth && unsubscribeHandler && typeof unsubscribeHandler === 'function') {
      await unsubscribeHandler({subscription, token});
    }
    res.json({"unsubscribe":true});
  });

  const send = async (sub=null, message={}) => {
    let notification = message||{"title":"New Message"};
    let payload = JSON.stringify(notification);
    await webpush.sendNotification(sub, payload).then(result=>{
      return result.success.push({"sub":sub, "code":result.statusCode, "message":"OK"});
    }).catch(err=>{
      if (err.statusCode === 410) {
        if (unsubscribeHandler && typeof unsubscribeHandler === 'function') {
          unsubscribeHandler(sub);
        }
      }
      return ({"sub":sub, "code":err.statusCode, "message":err.body});
    });
  };

  return {
    setDetails,
    generateKeys,
    send,
    onSubscribe,
    onUnsubscribe,
    "express":(options={}) => {
      return (req, res, next) => {
        return router(req, res, next);
      };
    }
  };

}

module.exports = Push;
