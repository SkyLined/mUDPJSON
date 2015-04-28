module.exports = cSender;

var mEvents = require("events"),
    mDGram = require("dgram");
    cSender_fSendBuffers = require("./cSender_fSendBuffers"),
    dxSettings = require("./dxSettings"),
    mUtil = require("util");

function cSender(dxOptions) {
  if (this.constructor != arguments.callee) throw new Error("This is a constructor, not a function");
  // options: uIPVersion, sHostname, uPort
  // emits: error, start, stop
  var oThis = this;
  dxOptions = dxOptions || {};
  var uIPVersion = dxOptions.uIPVersion || dxSettings.uIPVersion;
  oThis._sHostname = dxOptions.sHostname || {4: "255.255.255.255", 6: "ff02::1"}[uIPVersion],
  oThis._uPort = dxOptions.uPort || dxSettings.uPort;
  // When an attempt is made to send a packet larger than the MTU, an exception may be raised or the packet may be
  // silently dropped. In the later case, you will need to specify a lower MTU value in order to communicate using UDP.
  // In the former case, the exception is handled and used to determine the upper limit for the MTU value. The packet
  // is then divided into smaller chunks and resend. TODO: figure out if a DoS is possible by making this machine
  // believe the MTU is 0.
  oThis._uUpperLimitForMTU = dxOptions.uMTU;
  var sId = "UDP" + uIPVersion + "@" + oThis._sHostname + ":" + oThis._uPort;
  Object.defineProperty(oThis, "sId", {"get": function () { return sId; }});
  var bStarted = false;
  Object.defineProperty(oThis, "bStarted", {"get": function () { return bStarted; }});
  oThis._oSocket = mDGram.createSocket("udp" + uIPVersion);
  Object.defineProperty(oThis, "bStopped", {"get": function () { return oThis._oSocket == null; }});
  oThis._aoSendQueue = [];
  oThis._bSendThreadRunning = false;

  oThis._oSocket.on("listening", function cSender_on_oSocket_listening() {
    bStarted = true;
    oThis._oSocket.setBroadcast(true);
    oThis.emit("start");
  });
  oThis._oSocket.on("error", function cSender_on_oSocket_error(oError) {
    oThis.emit("error", oError); // pass-through
  });
  oThis._oSocket.on("close", function cSender_on_oSocket_close() {
    oThis._oSocket = null;
    oThis.emit("stop");
  });
  oThis._oSocket.bind({
    "exclusive": false,
  });
};
mUtil.inherits(cSender, mEvents.EventEmitter);

cSender.prototype.toString = function cSender_toString() {
  var oThis = this;
  return oThis.sId;
};

cSender.prototype.fStop = function cSender_fStop() {
  var oThis = this;
  oThis._oSocket && oThis._oSocket.close();
};

cSender.prototype.fSendMessage = function cSender_fSendMessage(xMessage, fCallback) {
  // callback argument: oError
  var oThis = this;
  if (oThis._oSocket == null) {
    throw new Error("The socket has been closed");
  };
  var sMessage = JSON.stringify(xMessage);
  if (sMessage.length > dxSettings.uMaxMessageLength) {
    throw new Error("Message is too large to send");
  };
  var oMessageBuffer = new Buffer(sMessage.length + ";" + sMessage + ";");
  
  oThis._aoSendQueue.push({"aoBuffers": [oMessageBuffer], "fCallback": fCallback});
  if (!oThis._bSendThreadRunning) {
    cSender_fSendBuffers(oThis);
  };
};
cSender.prototype.fStop = function cSender_fClose() {
  var oThis = this;
  if (oThis._oSocket == null) throw new Error("The sender is already stopped");
  oThis._oSocket.close();
};
