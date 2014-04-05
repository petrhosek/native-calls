define(["JSONRPC", "RPCTransport", "NaClModule", "fakemodule"], function(JSONRPC, RPCTransport, NaClModule, fakemodule){
  describe("JSONRPC Layer", function() {
    var testModuleId = "jsonrpc-layer";
    var fakeAttrs = {src:'rpc-module.nmf', name:'myRPC', id:testModuleId, type:'application/x-pnacl'};

    var myModule, transport, rpcRuntime;


    beforeEach(function() {
      // remove the naclmodule after each test.
      var listenerElement = document.getElementById(testModuleId+'-listener');
      if(listenerElement){
        listenerElement.parentNode.removeChild(listenerElement);
      }
      myModule = fakemodule.createModuleWithFakeEmbed(new NaClModule(fakeAttrs));
      transport = new RPCTransport(myModule);

      // load the transport before each test.
      var loaded = false;
      transport.load(function(){
        loaded = true;
      });

      waitsFor(function(){
        return loaded;
      }, "the module to load", 1000);
      rpcRuntime = jasmine.createSpyObj("rpcRuntime", ["setJSONRPC", "handleRequest", "handleCallback", "handleError"])
    });



    it("should construct with/without a transport", function(){
      var jsonRPC = new JSONRPC(transport);
      expect(jsonRPC).toBeDefined();
    });



    it("should update the transport when constructed with one", function(){
      spyOn(RPCTransport.prototype, "setJSONRPC");
      var transport = new RPCTransport(myModule);
      var jsonRPC = new JSONRPC(transport);
      expect(transport.setJSONRPC).toHaveBeenCalledWith(jsonRPC);
    });



    //spec: http://www.jsonrpc.org/specification#request_object
    it("should validate json-rpc requests according to spec", function(){
      // passing cases
      // request (4)
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 1
      })).toBe(true);

      //string id
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : "mymethod1"
      })).toBe(true);

      // null id
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : null
      })).toBe(true);

      // notification (4.1)
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"]
      })).toBe(true);

      // without params
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "id"     : 1
      })).toBe(true);

      // failing cases
      // without jsonrpc
      expect(JSONRPC.prototype.validateRPCRequest({
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 1
      })).toBe(false);

      // bogus jsonrpc
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "hello",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 1
      })).toBe(false);

      // non string method
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : 1163936,
        "params" : ["hello!"],
        "id"     : 1
      })).toBe(false);

      // non string/number/null id
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : {"this": "should fail."}
      })).toBe(false);

      // fractional id
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 2/3
      })).toBe(false);

      // not a request
      expect(JSONRPC.prototype.validateRPCRequest({
        "jsonrpc": "2.0",
        "result" : 19,
        "id"     : 1
      })).toBe(false);

    });



    // spec: http://www.jsonrpc.org/specification#response_object
    it("should validate json-rpc callbacks according to spec", function(){
      var json; //we shall test json with different methods
      // passing cases
      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "result" : 19,
        "id"     : 1
      })).toBe(true);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);

      expect(JSONRPC.prototype.validateRPCCallback({
        "jsonrpc": "2.0",
        "result" : 19,
        "id"     : "myID1"
      })).toBe(true);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);

      expect(JSONRPC.prototype.validateRPCError({
        "jsonrpc": "2.0",
        "error" : {
          "code" : -32700,
          "message" : "failed to parse",
          "data"    : "the server failed to parse the message: 123"
        },
        "id"     : 1
      })).toBe(true);

      expect(JSONRPC.prototype.validateRPCError({
        "jsonrpc": "2.0",
        "error" : {
          "code" : -32700,
          "message" : "failed to parse"
        },
        "id"     : 1
      })).toBe(true);


      // failing cases
      // without jsonrpc
      json = {
        "result" : 19,
        "id"     : 1
      };
      expect(JSONRPC.prototype.validateRPCCallback(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);

      // can't have both result and error
      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "result" : 19,
        "error"  : {},
        "id"     : 1
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);

      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "result": 23,
        "error" : {
          "code" : -32700,
          "message" : "failed to parse",
          "data"    : "the server failed to parse the message: 123"
        },
        "id"     : 1
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);

      // can't have a response without an id!
      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "result" : 19,
        "error"  : {}
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);

      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "result": 23,
        "error" : {
          "code" : -32700,
          "message" : "failed to parse",
          "data"    : "the server failed to parse the message: 123"
        }
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);


      // can't have an error without error object
      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "error" : 19,
        "id"     : 1
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);


      // can't have an error without error code
      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "error" : {
          "message" : "failed"
        },
        "id"     : 1
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);


      // can't have an error without error message
      expect(JSONRPC.prototype.validateRPCCallback(json = {
        "jsonrpc": "2.0",
        "error" : {
          "code" : -32700
        },
        "id"     : 1
      })).toBe(false);
      expect(JSONRPC.prototype.validateRPCError(json)).toBe(false);
      expect(JSONRPC.prototype.validateRPCRequest(json)).toBe(false);



    });



    // spec: http://www.jsonrpc.org/specification#batch
    it("should validate json-rpc batch calls according to spec", function(){
    });



    it("should send json-rpc requests", function(){
      // new request
      spyOn(JSONRPC.prototype, "validateRPCRequest").andCallThrough();
      spyOn(myModule, "postMessage");

      var request = {
            "jsonrpc": "2.0",
            "method" : "helloWorld",
            "params" : ["hello!"],
            "id"     : 1
          },
          jsonRPC = new JSONRPC(transport);

      jsonRPC.sendRPCRequest(request);

      // check validate called
      expect(jsonRPC.validateRPCRequest).toHaveBeenCalled();

      // check postMessage called
      expect(myModule.postMessage).toHaveBeenCalled();
    });



    it("should fail to send request if transport wasn't provided", function(){
      // new request
      spyOn(JSONRPC.prototype, "validateRPCRequest").andCallThrough();
      spyOn(myModule, "postMessage");

      var request = {
            "jsonrpc": "2.0",
            "method" : "helloWorld",
            "params" : ["hello!"],
            "id"     : 1
          },
          jsonRPC = new JSONRPC();


      expect(function(){
        jsonRPC.sendRPCRequest(request);
      }).toThrow();

      // check postMessage called
      expect(myModule.postMessage).not.toHaveBeenCalled();
    });



    it("should handle json-rpc callbacks", function(){
      spyOn(JSONRPC.prototype, "handleRPCCallback").andCallThrough();
      spyOn(JSONRPC.prototype, "validateRPCCallback").andCallThrough();
      spyOn(JSONRPC.prototype, "validateRPCError").andCallThrough();
      spyOn(JSONRPC.prototype, "validateRPCRequest").andCallThrough();

      var jsonRPC = new JSONRPC(transport, rpcRuntime);

      // 3 cases to check: call, callback, and error
      var callJSON = {
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 1
      };

      var callbackJSON = {
        "jsonrpc": "2.0",
        "result" : 19,
        "id"     : 1
      };

      var errorJSON = {
        "jsonrpc": "2.0",
        "error" : {
          "code" : -32700,
          "message" : "failed to parse",
          "data"    : "the server failed to parse the message: 123"
        },
        "id"     : 1
      };


      // send all the json-rpc messages from the module
      var messageCount = 0;
      myModule.on("message", function(){
        messageCount++;
      });

      myModule.moduleEl.fakeMessage(callJSON);
      myModule.moduleEl.fakeMessage(callbackJSON);
      myModule.moduleEl.fakeMessage(errorJSON);

      waitsFor(function(){
        return messageCount >= 3;
      }, "the messages to be sent", 1000);


      // check validates called
      runs(function(){
        expect(jsonRPC.handleRPCCallback.calls.length).toEqual(3); //called 3 times
        expect(jsonRPC.validateRPCRequest).toHaveBeenCalled();
        expect(jsonRPC.validateRPCCallback).toHaveBeenCalled();
        expect(jsonRPC.validateRPCError).toHaveBeenCalled();
      });


    });


    it("should call runtime methods when handling a json-rpc message, if a runtime is provided", function(){
      new JSONRPC(transport, rpcRuntime);

      // 3 cases to check: call, callback, and error
      var callJSON = {
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 1
      };

      var callbackJSON = {
        "jsonrpc": "2.0",
        "result" : 19,
        "id"     : 1
      };

      var errorJSON = {
        "jsonrpc": "2.0",
        "error" : {
          "code" : -32700,
          "message" : "failed to parse",
          "data"    : "the server failed to parse the message: 123"
        },
        "id"     : 1
      };


      // send all the json-rpc messages from the module
      var messageCount = 0;
      myModule.on("message", function(){
        messageCount++;
      });

      myModule.moduleEl.fakeMessage(callJSON);
      myModule.moduleEl.fakeMessage(callbackJSON);
      myModule.moduleEl.fakeMessage(errorJSON);

      waitsFor(function(){
        return messageCount >= 3;
      }, "the messages to be sent", 1000);


      // check validates called
      runs(function(){
        expect(rpcRuntime.handleRequest).toHaveBeenCalled();
        expect(rpcRuntime.handleCallback).toHaveBeenCalled();
        expect(rpcRuntime.handleError).toHaveBeenCalled();
      });


    });

    it("shouldn't call rpc runtime methods if a runtime is not set", function(){
      spyOn(console, "error");
      new JSONRPC(transport);

      // 3 cases to check: call, callback, and error
      var callJSON = {
        "jsonrpc": "2.0",
        "method" : "helloWorld",
        "params" : ["hello!"],
        "id"     : 1
      };

      var callbackJSON = {
        "jsonrpc": "2.0",
        "result" : 19,
        "id"     : 1
      };

      var errorJSON = {
        "jsonrpc": "2.0",
        "error" : {
          "code" : -32700,
          "message" : "failed to parse",
          "data"    : "the server failed to parse the message: 123"
        },
        "id"     : 1
      };


      // send all the json-rpc messages from the module
      var messageCount = 0;
      myModule.on("message", function(){
        messageCount++;
      });

      myModule.moduleEl.fakeMessage(callJSON);
      myModule.moduleEl.fakeMessage(callbackJSON);
      myModule.moduleEl.fakeMessage(errorJSON);

      waitsFor(function(){
        return messageCount >= 3;
      }, "the messages to be sent", 1000);


      // check runtime methods not called
      runs(function(){
        expect(rpcRuntime.handleRequest).not.toHaveBeenCalled();
        expect(rpcRuntime.handleCallback).not.toHaveBeenCalled();
        expect(rpcRuntime.handleError).not.toHaveBeenCalled();
        expect(console.error.calls.length).toEqual(3); //should print 3 error messages
      });


    });



  });
});