var cSender = require("./cSender.js"),
    cReceiver = require("./cReceiver.js");

function startReceiver(fCallback) {
  var oReceiver = new cReceiver();
  oReceiver.on("error", function (oError) {
    console.log("Receiver:error (oError =", oError, ")");
  });
  oReceiver.on("start", function () {
    console.log("Receiver:start");
    fCallback(oReceiver);
  });
  oReceiver.on("message", function (oSender, oError, xMessage) {
    console.log("Receiver:message (oSender =", oSender, ", oError =", oError, ", xMessage =", xMessage);
  });
  oReceiver.on("stop", function () {
    console.log("Receiver:stop");
  });
};

function startSender(fCallback) {
  var oSender = new cSender();
  oSender.on("error", function (oError) {
    console.log("Sender:error (oError =", oError, ")");
  });
  oSender.on("start", function () {
    console.log("Sender:start");
    fCallback(oSender);
  });
  oSender.on("stop", function () {
    console.log("Sender:stop");
  });
};

var oMessage = {"sGreeting": "Hello, world!", "sLargeBuffer": new Array(80000).join("A")};
var uMessageCount = 3;
startReceiver(function(oReceiver) {
  startSender(function(oSender) {
    var uSendMessages = 0;
    for (var u = 0; u < uMessageCount; u++) {
      oSender.fSendMessage(oMessage, function (oError) {
        console.log("Sender.fSendMessage:callback (oError =", oError);
        // After the messages are sent, the sender is no longer needed
        if (++uSendMessages == uMessageCount) {
          oSender.fStop();
        }
      });
    }
  });
  var uReceivedMessages = 0;
  oReceiver.on("message", function () {
    // After the messages are received, the receiver is no longer needed
    if (++uReceivedMessages == uMessageCount) {
      oReceiver.fStop();
    }
  });
});
