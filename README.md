mUDPJSON
===============

Module with classes to send and receive data as JSON over UDP.

Getting Started
---------------
1. Install mUDPJSON via NPM.
  
  `npm install mudpjson`
  
  Optionally: rename `mudpjson` to `mUDPJSON`: npm is unable to handle the
  complexity of uppercase characters in a module name. Node.js on Windows does
  not have this problem, so renaming the folder is not required for you to use
  the module.
  
2. Require mUDPJSON in your project.
  
  `var mUDPJSON=require("mUDPJSON");`

3. Instantiate a cReceiver to receive data.
  
  ```
  var oUDPJSONReceiver = new mUDPJSON.cReceiver();
  oUDPJSONReceiver.on("message", function (oError, xData) {
    if (oError) {
      // Handle oError
    } else {
      // Process xData
    }
  });
  ```

4. Instantiate a cSender to send data.
  ```
  var oUDPJSONSender = new mUDPJSON.cSender();
  oUDPJSONSender.on("start", function() {
    oUDPJSONSender.fSendMessage("Anything that can be stringified", function (oError) {
      if (oError) {
        // Handle oError
      }
    });
  });
  ```

Notes
-----
The `cSender` and `cReceiver` instances can be on the same machine or on two
different machines. By default `cSender` broadcasts to all machines on the local
subnet.

`cSender.fSendMessage` is used to send a message that consist of one value
converted to a string using `JSON.stringify`. `cReveiver` emits one `message`
event for each such message received, with two parameters. The first parameter
is an `_Error_` object if an invalid message was received or undefined if the
message was valid. The second parameter is the value that was sent,
reconstructed from the data in the message using `JSON.parse`.

The protocol used to transmit data is simple and robust. Each message sent
starts with a string that represents the length of the JSON data in the message,
followed by a semi colon. This is followed by the actual JSON data and another
semicolon. Messages that are larger than the maximum transfer unit (MTU) of the
network are broken into smaller chunks. However, to reduce the risk of a sender
swamping a receiver with data, there is a limit of 1Mb on the size of the JSON
data that can be transmitted in one message.

Example:
  ```
  14;"Hello, World";
  ```
Where `"Hello, World"` is of course 14 characters long. If a message is received
that is not in accordance with the protocol, the receiver emits an "error"
event.

API
-----
### `class cSender`
Can be used to send values as JSON to one or more receivers.

#### Constructors:
##### `[new] mUDPJSON.cSender(_Object_ dxOptions);`
Used to send values as JSON data over UDP.
Where `dxOptions` is an object that can have the following properties:
- `_Number_ uIPVersion`: IP version to use (valid values: 4 (default), 6).
- `_String_ sHostname`: Target computer (default: broadcast to local subnet).
- `_Number_ uPort`: port number to send to (default: 28876).

#### Events:
##### `error`, parameter: `_Error_ oError`
Emitted when there is a network error.
##### `start`
Emitted when the `cSender` instance is ready to send messages. You do not need
to wait until this event is emitted before sending messages: these are queued
until the `cSender` instance is ready to send them.
##### `stop`
Emitted when the `cSender` instance has stopped sending messages. This happens
when there is a network error or after you tell the sender to stop.

#### Methods:
##### `fSendMessage(_Any_ xMessage, _Function_ fCallback)`
Convert the data in `xMessage`. `fCallback(_Boolean_ bSuccess)` is called when
the message has been sent (`bSuccess == true`) or when there was an error
(`bSuccess == false`). 

##### `fStop()`
Stop the `cSender` instance.

### `class cReceiver`
Used to receive values as JSON data over UDP.

#### Constructors:
##### `[new] mUDPJSON.cReceiver(_Object_ dxOptions);`
Used to receive values as JSON data over UDP.
Where `dxOptions` is an object that can have the following properties:
- `_Number_ uIPVersion`: IP version to use (valid values: 4 (default), 6).
- `_String_ sHostname`: Network device to bind to (default: computer name, use `localhost`
             if you want to receive messages only from `cSender` instances on
             the same machine).
- `_Number_ uPort`: port number to receive messages on (default: 28876).

#### Events:
##### `error`, parameter: `_Error_ oError`
Emitted when there is a network error.
##### `start`
Emitted when the `cReceiver` instance is ready to receive messages.
##### `message`, parameters: `_Error_ oError`, `_Any_ xData`
Emitted when the cReceiver instance has received a message. If the message was
invalid, `oError` will contain a description of the problem. Otherwise, `oError`
will be undefined and xData will contain the data sent by the cSender instance.
##### `stop`
Emitted when the `cReceiver` instance has stopped receiving messages. This
happens when there is a network error or after you tell the receiver to stop.

#### Methods:
##### `fStop()`
Stop the `cReceiver` instance.

--------------------------------------------------------------------------------

### License
This code is licensed under [CC0 v1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
