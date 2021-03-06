#include "RPCTransport.h"
#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"

#include "JSONRPC.h"

#include <stdio.h>
#include "Bench.h"

namespace pprpc{
RPCTransport::RPCTransport(PP_Instance instance) : Instance(instance) {
	init();
}

RPCTransport::RPCTransport(PP_Instance instance, JSONRPC* jsonRPC) : Instance(instance) {
	init(jsonRPC);
}


void RPCTransport::HandleMessage(const pp::Var& message) {
	uint64_t start = Bench::start("RPCTransport::HandleMessage");
	if(hasJSONRPC){
		jsonRPC->HandleRPC(message);
	}
	Bench::end(start);
}

void RPCTransport::PostMessage(const pp::Var& message) {
	pp::Instance::PostMessage(message);
}


RPCTransport::~RPCTransport() {
	// fprintf(stdout, "\nRPCTransport::~RPCTransport()\n");
}

void RPCTransport::init() {
	hasJSONRPC = false;
}


void RPCTransport::init(JSONRPC* jsonRPC) {
	this->setJSONRPC(jsonRPC);
	jsonRPC->setTransport(this);
	hasJSONRPC = true;
}

} /*namespace pprpc*/
