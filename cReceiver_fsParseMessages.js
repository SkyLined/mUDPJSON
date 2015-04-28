module.exports = cReceiver_fsParseMessages;

var dxSettings = require("./dxSettings");

function cReceiver_fsParseMessages(oThis, oSender, sBuffer) {
  while (sBuffer) {
    var sLength = sBuffer.substr(0, dxSettings.uMaxMessageLength + 1),
        uLengthEndIndex = sLength.indexOf(";"),
        bInvalidMessageLength = false,
        bValidMessageLength = false,
        uMessageLength;
    if (uLengthEndIndex == -1) {
      bInvalidMessageLength = sLength.length > dxSettings.uMaxMessageLength.toString().length;
    } else {
      var sLength = sLength.substr(0, uLengthEndIndex);
      bInvalidMessageLength = sLength.length > dxSettings.uMaxMessageLength.toString().length;
      if (!bInvalidMessageLength) {
        try {
          uMessageLength = JSON.parse(sLength);
          bInvalidMessageLength = uMessageLength.constructor != Number || uMessageLength <= 0 || uMessageLength > dxSettings.uMaxMessageLength;
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
