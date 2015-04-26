module.exports = function cSender_fSendBuffers(oThis) {
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
