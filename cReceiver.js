module.exports = cReceiver;

var mEvents = require("events"),
    mDGram = require("dgram"),
    mDNS = require("dns"),
    mOS = require("os"),
    cReceiver_fsParseMessages = require("./cReceiver_fsParseMessages"),
    mUtil = require("util");

function cReceiver(dxOptions) {
  if (this.constructor != arguments.callee) return new arguments.callee(dxOptions);
  // options: uIPVersion, sHostname, uPort
  // emits: error, start, message, stop
  var oThis = this;
  dxOptions = dxOptions || {};
  var uIPVersion = dxOptions.uIPVersion || mSettings.uIPVersion,
      sHostname = dxOptions.sHostname || mOS.hostname(),
      uPort = dxOptions.uPort || mSettings.uPort,
      sId = "UDP" + uIPVersion + "@" + sHostname + ":" + uPort;
  Object.defineProperty(oThis, "sId", {"get": function () { return sId; }});
  var bStarted = false;
  Object.defineProperty(oThis, "bStarted", {"get": function () { return bStarted; }});
  oThis._oSocket = mDGram.createSocket("udp" + uIPVersion);
  Object.defineProperty(oThis, "bStopped", {"get": function () { return oThis._oSocket == null; }});
  
  oThis._oSocket.on("listening", function cReceiver_on_oSocket_listening() {
    bStarted = true;
    oThis.emit("start");
  });
  oThis._oSocket.on("error", function cReceiver_on_oSocket_error(oError) {
    oThis.emit("error", oError); // pass-through
  });
  oThis._oSocket.on("close", function cReceiver_on_oSocket_close() {
    oThis._oSocket = null;
    oThis.emit("stop");
  });
  var dsBuffer_by_oSender = {};
  oThis._oSocket.on("message", function cReceiver_on_oSocket_message(oMessage, oRemoteAddress) {
    var oSender = {"sHostname": oRemoteAddress.address, "uPort": oRemoteAddress.port};
    dsBuffer_by_oSender[oSender] = (dsBuffer_by_oSender[oSender] || "") + oMessage.toString();
    dsBuffer_by_oSender[oSender] = cReceiver_fsParseMessages(oThis, oSender, dsBuffer_by_oSender[oSender]);
    if (!dsBuffer_by_oSender[oSender]) {
      delete dsBuffer_by_oSender[oSender];
    };
  });
  // Wait a tick before looking up the hostname, so the caller has time to add
  // an event listener for the "error" event that this may throw.
  process.nextTick(function() {
    mDNS.lookup(sHostname, {"family": uIPVersion}, function (oError, sAddress, uFamily) {
      if (oError) {
        oThis.emit("error", oError);
      } else if (uFamily != uIPVersion) {
        oThis.emit("error", new Error("requested address for IPv" + uIPVersion + ", got IPv" + uFamily));
      } else {
        oThis._oSocket && oThis._oSocket.bind({
          "address": sAddress,
          "port": uPort,
          "exclusive": false,
        });
      };
    });
  });
};
mUtil.inherits(cReceiver, mEvents.EventEmitter);

cReceiver.prototype.toString = function cReceiver_toString() {
  var oThis = this;
  return oThis.sId;
};

cReceiver.prototype.fStop = function cReceiver_fStop() {
  var oThis = this;
  oThis._oSocket && oThis._oSocket.close();
};

