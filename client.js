'use strict';

function Push(publicKey) {

  const app = (publicKey) => {

    let messageHandler;    
    const onMessage = (cb) => {
      messageHandler = cb;
    };

    const convert = (str) => {
      return new Uint8Array(atob(str.replace(/\-/g,'+').replace(/\_/g,'/')).split('').map(val=>{return val.charCodeAt(0);}));
    };

    const subscribe = async (url=null, token=null) => {

      if (('!PushManager' in window) || ('!Notification' in window)) {
        throw({"message":"This browser or device does not support push notifications."});
      }

      let permission = await Notification.requestPermission();
      if (!permission || permission !== 'granted') {
        throw({"message":"Notifications permission is required to subscribe to push notifications."});
      }

      let subscription = await (await navigator.serviceWorker.getRegistration()).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convert(publicKey)
      }).then(result=>{return result.toJSON();}).catch(err=>{console.log(err);});
      if (!url) {
        return {"message":"Push notifications are available. You are not yet subscribed to a remote service.", "subscribed":false, subscription};
      }
      return fetch(url, {
        method: "POST",
        body: JSON.stringify({subscription, token}),
        headers: {
          "content-type": "application/json"
        }
      }).then(response => {
        return {"message":"Push notifications are enabled.", "subscribed":true, subscription};
      }).catch(err=>{
        console.log(err);
        return err;
      });;
    };

    const unsubscribe = async (url=null, token=null) => {
      let subscription = await (await navigator.serviceWorker.getRegistration()).pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      if (!url) {
        return {"unsubscribe":true};
      }
      return fetch(url, {
        method: "POST",
        body: JSON.stringify({subscription, token}),
        headers: {
          "content-type": "application/json"
        }
      }).then(response => {
        return {"unsubscribe":true};
      }).catch(err=>{
        console.log(err);
        return err;
      });
    };

    navigator.serviceWorker.addEventListener('message', (e) => {
      if (messageHandler && typeof messageHandler === 'function') {
        if (e.data && e.data.type && e.data.type === 'push') {
          messageHandler(e.data.data||"");
        }
      }
    });

    return {onMessage, subscribe, unsubscribe, "getPermission":Notification.requestPermission};

  };

  const sw = () => {

    let messageHandler;
    let onMessage = (cb) => {
      messageHandler = cb;
    };

    let clickHandler;
    let onClick = (cb) => {
      clickHandler = cb;
    };

    self.addEventListener("push", async (e) => {
      let data = {};
      if (e.data) {
        data = e.data.json();
      }
      let openClients = await clients.matchAll();
      if (openClients) {
        let bg = true;
        openClients.forEach(client=>{
          if (client.visibilityState === 'visible') {
            bg = false;
          }
          client.postMessage({"type":"push", "data":data});
        });
        if (bg) {
          if (messageHandler && typeof messageHandler === 'function') {
            messageHandler(data);
          }
        }
      } else {
        if (messageHandler && typeof messageHandler === 'function') {
          messageHandler(data);
        }
      }
    });

    self.addEventListener('notificationclick', (e) => {
      if (clickHandler && typeof clickHandler === 'function') {
        clickHandler(e.notification);
      }
      e.notification.close(); 
    });

    let SW = {onMessage, onClick};
    return SW;

  };

  if (typeof window !== 'object') {
    return sw();
  }

  return app(publicKey);

}
