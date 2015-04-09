module.exports = cReceiver;

var guMaxMessageLength = 1000000; // bytes

var mEvents = require("events"),
    mDGram = require("dgram"),
    mOS = require("os"),
    mUtil = require("util");

function cReceiver(dxOptions) {
  if (this.constructor != arguments.callee) return new arguments.callee(dxOptions);
  // options: uIPVersion, sHostname, uPort
  // emits: error, start, message, stop
  var oThis = this;
  dxOptions = dxOptions || {};
  var uIPVersion = dxOptions.uIPVersion || 4,
      sHostname = dxOptions.sHostname || mOS.hostname(),
      uPort = dxOptions.uPort || 28876;
  oThis._sId = "UDP" + uIPVersion + "@" + sHostname + ":" + uPort;
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

function cReceiver_fsParseMessages(oThis, oSender, sBuffer) {
  while (sBuffer) {
    var sLength = sBuffer.substr(0, guMaxMessageLength + 1),
        uLengthEndIndex = sLength.indexOf(";"),
        bInvalidMessageLength = false,
        bValidMessageLength = false,
        uMessageLength;
    if (uLengthEndIndex == -1) {
      bInvalidMessageLength = sLength.length > guMaxMessageLength.toString().length;
    } else {
      var sLength = sLength.substr(0, uLengthEndIndex);
      bInvalidMessageLength = sLength.length > guMaxMessageLength.toString().length;
      if (!bInvalidMessageLength) {
        try {
          uMessageLength = JSON.parse(sLength);
          bInvalidMessageLength = uMessageLength.constructor != Number || uMessageLength <= 0 || uMessageLength > guMaxMessageLength;
        } catch (oError) {
          bInvalidMessageLength = true;
        };
      };
    };
    if (bInvalidMessageLength) {
      // The remote is not making any sense, disconnect.
      oThis.emit("message", oSender, new Error("Invalid message length: " + JSON.stringify(sLength + sBuffer.charAt(uLengthEndIndex))), undefined);
      return;
    } else if (uMessageLength == undefined) {
      // The message length has not been received entirely yet.
      return sBuffer;
    } else {
      var uMessageStartIndex = uLengthEndIndex + 1,
          uMessageEndIndex = uMessageStartIndex + uMessageLength;
      if (sBuffer.length < uMessageEndIndex + 1) {
        // The message length has been received entirely but the message only partially
        return sBuffer;
      } else {
        sMessage = sBuffer.substr(uMessageStartIndex, uMessageEndIndex - uMessageStartIndex);
        if (sBuffer.charAt(uMessageEndIndex) != ";") {
          oThis.emit("message", oSender, new Error("Message is missing semi-colon: " + JSON.stringify(sMessage + sBuffer.charAt(uMessageEndIndex))), undefined);
          return;
        } else {
          try {
            var xMessage = JSON.parse(sMessage);
          } catch (oJSONError) {
            var oError = oJSONError;
          };
          sBuffer = sBuffer.substr(uMessageEndIndex + 1);
          oThis.emit("message", oSender, oError, xMessage);
        };
      };
    };
  };
};
