var cSender = require("./cSender.js"),
    cReceiver = require("./cReceiver.js");

var bMessageSent = false,
    bMessageReceived = false,
    bSenderStopped = false,
    bReceiverStopped = false,
    oReceiver = new cReceiver(),
    oSender = new cSender();
oReceiver.on("start", function () {
  console.log("Receiver started (" + oReceiver + ")");
  fSendMessageWhenReady();
});
oReceiver.on("message", function (oSender, oError, xMessage) {
  if (oError) throw oError;
  if (xMessage != "message") throw new Error("Invalid message");
  console.log("Sender->Receiver: message received (oSender = " + JSON.stringify(oSender) + ")");
  bMessageReceived = true;
  oReceiver.fStop();
});
oReceiver.on("stop", function () {
  bReceiverStopped = true;
  fReportFinishedWhenDone("Receiver");
});
oSender.on("start", function () {
  console.log("Sender started (" + oSender + ")");
  fSendMessageWhenReady();
});
oSender.on("stop", function () {
  bSenderStopped = true;
  fReportFinishedWhenDone("Sender");
});

function fSendMessageWhenReady() {
  if (oSender.bStarted && oReceiver.bStarted) {
    oSender.fSendMessage("message", function (oError) {
      if (oError) throw oError;
      bMessageSent = true;
      oSender.fStop();
    });
    console.log("Sender->Receiver: message sent");
  };
};
function fReportFinishedWhenDone(sSide) {
  console.log(sSide + " stopped");
  if (bReceiverStopped && bSenderStopped) {
    if (!bMessageSent) throw new Error("The sender did not send a message");
    if (!bMessageReceived) throw new Error("The receiver did not receive a message");
    console.log("test completed successfully");
  };
};