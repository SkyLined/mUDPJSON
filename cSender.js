module.exports = cSender;

var guMaxMessageLength = 1000000; // bytes

var mEvents = require("events"),
    mDGram = require("dgram");
    mUtil = require("util");

function cSender(dxOptions) {
  if (this.constructor != arguments.callee) return new arguments.callee(dxOptions);
  // options: uIPVersion, sHostname, uPort
  // emits: error, start, stop
  var oThis = this;
  dxOptions = dxOptions || {};
  var uIPVersion = dxOptions.uIPVersion || 4;
  oThis._sHostname = dxOptions.sHostname || {4: "255.255.255.255", 6: "ff02::1"}[uIPVersion],
  oThis._uPort = dxOptions.uPort || 28876;
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
  if (sMessage.length > guMaxMessageLength) {
    throw new Error("Message is too large to send");
  };
  var oMessageBuffer = new Buffer(sMessage.length + ";" + sMessage + ";");
  
  oThis._aoSendQueue.push({"aoBuffers": [oMessageBuffer], "fCallback": fCallback});
  if (!oThis._bSendThreadRunning) {
    cSender_fSendBuffers(oThis);
  };
};
function cSender_fSendBuffers(oThis) {
  if (oThis._oSocket == null) {
    fCallback && fCallback(new Error("The socket has been closed"));
  } else {
    oThis._bSendThreadRunning = true;
    var aoBuffers = oThis._aoSendQueue[0].aoBuffers,
        fCallback = oThis._aoSendQueue[0].fCallback;
    var oBuffer = aoBuffers.shift();
    if (oThis._uUpperLimitForMTU && oBuffer.length >= oThis._uUpperLimitForMTU) {
      var uNewBufferLength = oThis._uUpperLimitForMTU >> 1;
      aoBuffers.unshift(oBuffer.slice(uNewBufferLength));
      oBuffer = oBuffer.slice(0, uNewBufferLength);
    };
    oThis._oSocket.send(oBuffer, 0, oBuffer.length, oThis._uPort, oThis._sHostname, function (oError) {
      if (oError) {
        if (oError.errno == "EMSGSIZE") {
          // The buffer was too large for sending as a single UDP packet, try again with MaxMTU set to the buffer's
          // size, causing the buffer to get chopped up into two smaller buffers before sending.
          oThis._uUpperLimitForMTU = oBuffer.length;
          aoBuffers.unshift(oBuffer);
          cSender_fSendBuffers(oThis);
        } else {
          oThis.fStop();
          oThis._bSendThreadRunning = false;
          // notify all queued callbacks
          fCallback && fCallback(oError);
          oThis._aoSendQueue.shift();
          while (oThis._aoSendQueue) {
            fCallback = oThis._aoSendQueue.shift().fCallback;
            fCallback && fCallback(oError);
          };
        };
      } else {
        if (aoBuffers.length) {
          // buffers sent, but more to be done, so sent the next:
          cSender_fSendBuffers(oThis);
        } else {
          fCallback && fCallback();
          oThis._aoSendQueue.shift();
          if (oThis._aoSendQueue.length) {
            cSender_fSendBuffers(oThis);
          } else {
            oThis._bSendThreadRunning = false;
          };
        };
      };
    });
  };
};
cSender.prototype.fStop = function cSender_fClose() {
  var oThis = this;
  if (oThis._oSocket == null) throw new Error("The sender is already stopped");
  oThis._oSocket.close();
};
