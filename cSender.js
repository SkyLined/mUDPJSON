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
  oThis.uIPVersion = dxOptions.uIPVersion || 4;
  oThis.sHostname = dxOptions.sHostname || {4: "255.255.255.255", 6: "ff02::1"}[oThis.uIPVersion],
  oThis.uPort = dxOptions.uPort || 28876;
  oThis.oSocket = mDGram.createSocket("udp" + oThis.uIPVersion);
  oThis.bSending = false;
  oThis.aoSendQueue = [];
  oThis.bSendThreadRunning = false;
  oThis.uMaxMTU = undefined;

  oThis.oSocket.on("listening", function cSender_on_oSocket_listening() {
    oThis.oSocket.setBroadcast(true);
    oThis.bSending = true;
    oThis.emit("start");
  });
  oThis.oSocket.on("error", function cSender_on_oSocket_error(oError) {
    oThis.emit("error", oError); // pass-through
  });
  oThis.oSocket.on("close", function cSender_on_oSocket_close() {
    oThis.bSending = false;
    oThis.oSocket = null;
    oThis.emit("stop");
  });
  oThis.oSocket.bind({
    "exclusive": false,
  });
}
mUtil.inherits(cSender, mEvents.EventEmitter);

cSender.prototype.fSendMessage = function cSender_fSendMessage(xMessage, fCallback) {
  // callback argument: oError
  var oThis = this;
  if (oThis.oSocket == null) {
    throw new Error("The socket has been closed");
  }
  var sMessage = JSON.stringify(xMessage);
  if (sMessage.length > guMaxMessageLength) {
    throw new Error("Message is too large to send");
  }
  var oMessageBuffer = new Buffer(sMessage.length + ";" + sMessage + ";");
  
  oThis.aoSendQueue.push({"aoBuffers": [oMessageBuffer], "fCallback": fCallback});
  if (!oThis.bSendThreadRunning) {
    cSender_fSendBuffers(oThis);
  }
}
function cSender_fSendBuffers(oThis) {
  oThis.bSendThreadRunning = true;
  var aoBuffers = oThis.aoSendQueue[0].aoBuffers,
      fCallback = oThis.aoSendQueue[0].fCallback;
  var oBuffer = aoBuffers.shift();
  if (oThis.uMaxMTU && oBuffer.length >= oThis.uMaxMTU) {
    var uNewBufferLength = oThis.uMaxMTU >> 1;
    aoBuffers.unshift(oBuffer.slice(uNewBufferLength));
    oBuffer = oBuffer.slice(0, uNewBufferLength);
  }
  oThis.oSocket.send(oBuffer, 0, oBuffer.length, oThis.uPort, oThis.sHostname, function (oError) {
    if (oError) {
      if (oError.errno == "EMSGSIZE") {
        // The buffer was too large for sending as a single UDP packet, try again with MaxMTU set to the buffer's
        // size, causing the buffer to get chopped up into two smaller buffers before sending.
        oThis.uMaxMTU = oBuffer.length;
        aoBuffers.unshift(oBuffer);
        cSender_fSendBuffers(oThis);
      } else {
        oThis.fStop();
        oThis.bSendThreadRunning = false;
        // notify all queued callbacks
        fCallback && fCallback(oError);
        oThis.aoSendQueue.shift();
        while (oThis.aoSendQueue) {
          fCallback = oThis.aoSendQueue.shift().fCallback;
          fCallback && fCallback(oError);
        }
      }
    } else {
      if (aoBuffers.length) {
        // buffers sent, but more to be done, so sent the next:
        cSender_fSendBuffers(oThis);
      } else {
        fCallback && fCallback();
        oThis.aoSendQueue.shift();
        if (oThis.aoSendQueue.length) {
          cSender_fSendBuffers(oThis);
        } else {
          oThis.bSendThreadRunning = false;
        }
      }
    }
  });
}
cSender.prototype.fStop = function cSender_fClose() {
  var oThis = this;
  oThis.oSocket.close();
}

module.exports = cSender;