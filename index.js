var path = require("path");
var sModuleName = path.basename(__dirname);
module.exports.cReceiver = require("./cReceiver");
module.exports.cSender = require("./cSender");
module.exports.dxSettings = require("./dxSettings");
