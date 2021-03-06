/**
 * Processes the given AST for errors, and produces an augmented version of the ast with easy access to the defined
 * dictionaries, interfaces, types, and other definitions in the idl.
 * @param ast
 * @constructor
 */
function AugmentedAST(ast) {
  "use strict";

  this.ast = ast;
  this.isAugmented = false;

  this.dictionaries = Object.create(null);
  this.interfaces = Object.create(null);
  this.typedefs = Object.create(null);
  this.exceptions = Object.create(null);
  this.enums = Object.create(null);

  // we use this queue to keep track of members, etc. that we need to check.
  this.typeCheckQueue = [];

  // we use this to squash the array
  this.removedIndices = [];

  // passing in an ast to the constructor starts augmenting it
  if (this.ast) {
    this.augment();
  }
}

/**
 * An array of supported WebIDL primitive types (static)
 * @type {string[]}
 */
AugmentedAST.prototype.primitiveTypes = ['any', 'boolean', 'byte', 'octet', 'short', 'unsigned short', 'long',
                                         'unsigned long', 'long long', 'unsigned long long', 'float',
                                         'unrestricted float', 'double', 'unrestricted double', 'DOMString'];

/**
 * Uses the augmented data to produce an array of types, including primitive, dictionary, interface, typedef, exception
 * and enum types that have been defined in the idl.
 * @returns {Array}
 */
AugmentedAST.prototype.generateAllowedTypesArray = function () {
  "use strict";
  return this.primitiveTypes.concat(Object.keys(this.dictionaries),
                                    Object.keys(this.interfaces),
                                    Object.keys(this.typedefs),
                                    Object.keys(this.exceptions),
                                    Object.keys(this.enums));
};

/**
 * Checks whether the given type is properly defined in the IDL.
 * @param t
 * @returns boolean
 */
AugmentedAST.prototype.isAllowedType = function (t) {
  var tname = this.getTypeName(t);
  return this.isPrimitiveType(tname) ||
         this.isDictionaryType(tname) ||
         this.isInterfaceType(tname) ||
         this.isExceptionType(tname) ||
         this.isEnumType(tname) ||
         this.isTypedefType(tname);
};

/**
 * Returns true if the given type is primitive
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.isPrimitiveType = function (t) {
  return this.primitiveTypes.indexOf(this.getTypeName(t)) > -1;
};

/**
 * Returns true if the given type has been defined as a dictionary in the IDL
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.isDictionaryType = function (t) {
  return this.dictionaries[this.getTypeName(t)] != undefined;
};

/**
 * Returns true if the given type has been defined as an interface in the IDL
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.isInterfaceType = function (t) {
  return this.interfaces[this.getTypeName(t)] != undefined;
};

/**
 * Returns true if the given type has been defined as a typedef in the IDL
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.isTypedefType = function (t) {
  return this.typedefs[this.getTypeName(t)] != undefined;
};

/**
 * Returns true if the given type has been defined as an exception in the IDL
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.isExceptionType = function (t) {
  return this.exceptions[this.getTypeName(t)] != undefined;
};

/**
 * Returns true if the given type has been defined as an enum in the IDL
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.isEnumType = function (t) {
  return this.enums[this.getTypeName(t)] != undefined;
};

/**
 * Adds the given type to a queue of types that need to be checked.
 * The queue is checked after all definitions have been processed first.
 * @param t
 */
AugmentedAST.prototype.addToTypeCheckQueue = function (t) {
  "use strict";
  if (Array.isArray(t)) {
    // concat
    this.typeCheckQueue = this.typeCheckQueue.concat(t);
  } else {
    // push
    this.typeCheckQueue.push(t);
  }
};

/**
 * Checks the given type is well defined.
 * In the process, adds more types to check depending on the type.
 * @param t
 * @returns {boolean}
 */
AugmentedAST.prototype.checkType = function (t) {
  "use strict";
  // t could be an operation, attribute, constant member.
  if (t.type === 'operation') {
    // check return type
    this.addToTypeCheckQueue(t.idlType);
    // check argument types
    this.addToTypeCheckQueue(t.arguments);
  } else if (t.type === 'attribute') {
    // TODO support attributes
  } else if (t.type === 'const') {
    // TODO Support constants
  } else if (t.idlType) {
    // it could also be an IDL Type
    this.addToTypeCheckQueue(t.idlType);
  } else if ((typeof t === 'string' || t instanceof String) && (this.isAllowedType(t))) {
    // it could also be a string representing a type (base case)
  } else {
    throw "Unsupported type: " + t;
  }

  return true;
};

/**
 * Adds a dictionary to our map of dictionaries
 * @param d The original ast dictionary object
 * @param index The index this dictionary is in the original ast
 * @returns {boolean} True if added successfully, false otherwise.
 */
AugmentedAST.prototype.addDictionary = function (d, index) {
  "use strict";
  //A dictionary looks like this
  //{ type: 'dictionary', name: 'Di', partial: false, members: [ [Object],[Object] ], inheritance: null, extAttrs: [] }

  // does the dictionary already exist?
  var existingDict = this.dictionaries[d.name];
  if (existingDict) {
    // exists. Augment if partial, otherwise throw
    if (d.partial) {
      existingDict.members = existingDict.members.concat(d.members);
      // add the new members to the check queue
      this.addToTypeCheckQueue(d.members);
      // get rid of duplicate
      this.ast[index] = null;
      this.removedIndices.push(index);
    } else {
      throw "The dictionary already exists: " + d.name;
    }
  } else {
    // doesn't exist. Add it as a new key.
    this.dictionaries[d.name] = d;
    // augment and add members
    for(var i = 0 ; i < d.members.length; i++){
      d.members[i].schemaType = this.idlTypeToSchema(d.members[i].idlType);
    }
    this.addToTypeCheckQueue(d.members);

  }

  return true;
};

/**
 * Adds a member of an interface to the interface.
 * This is used to allow easy access to the operations of the interface later on.
 * @param interfaceName
 * @param interfaceMember
 */
AugmentedAST.prototype.addInterfaceMember = function (interfaceName, interfaceMember) {
  if (this.interfaces[interfaceName] == undefined) {
    throw "The interface does not exist: " + interfaceName;
  }

  if (interfaceMember.type === 'operation') {
    // we add schema type info to the operation first
    interfaceMember.schemaType = this.idlTypeToSchema(interfaceMember.idlType);
    interfaceMember.interfaceName = interfaceName;

    if(interfaceMember.extAttrs && interfaceMember.extAttrs.length > 0){
      for(var i = 0; i < interfaceMember.extAttrs.length; i++){
        if(interfaceMember.extAttrs[i].name == "ThrowsRPCError"){
          interfaceMember.ThrowsRPCError = interfaceMember.extAttrs[i];
        }
      }
    }

    for(i = 0; i < interfaceMember.arguments.length; i++){
      interfaceMember.arguments[i].schemaType = this.idlTypeToSchema(interfaceMember.arguments[i].idlType);
      interfaceMember.arguments[i].paramIndex = i;
      if(i == interfaceMember.arguments.length-1){
        interfaceMember.arguments[i].finalParam = true;
      }
    }
    this.interfaces[interfaceName].operations.push(interfaceMember);
  }

};

/**
 * Adds an array of members to the interface.
 * @param interfaceName
 * @param interfaceMembers
 */
AugmentedAST.prototype.addInterfaceMembers = function (interfaceName, interfaceMembers) {
  this.addToTypeCheckQueue(interfaceMembers);
  for (var i = 0; i < interfaceMembers.length; i++) {
    this.addInterfaceMember(interfaceName, interfaceMembers[i]);
  }
};

/**
 * Adds a new interface to our map of interfaces.
 * Creates a new key, and creates an empty array of operations for that key for easy access later on.
 * @param newInterface
 */
AugmentedAST.prototype.addNewInterface = function (newInterface) {
  newInterface.operations = [];
  newInterface.interfaceName = newInterface.name;
  this.interfaces[newInterface.name] = newInterface;
  this.addInterfaceMembers(newInterface.name, newInterface.members);
};

/**
 * Adds a partial interface to the existing interface, then removes the original definition from the original ast.
 * @param partialInterface The original partial interface object from the original ast.
 * @param index The index the object is in the original ast (used for removing).
 */
AugmentedAST.prototype.addToExistingInterface = function (partialInterface, index) {
  var existingI = this.interfaces[partialInterface.name];
  if (existingI && partialInterface.partial) {
    existingI.members = existingI.members.concat(partialInterface.members);
    this.addInterfaceMembers(partialInterface.name, partialInterface.members);

    // remove partial definition
    this.ast[index] = null;
    this.removedIndices.push(index);
  } else {
    throw "The interface already exists: " + partialInterface.name;
  }

};

/**
 * Adds a new or partial interface to the map.
 * @param theInterface the original interface object from the original ast.
 * @param index The index the object is in the original ast.
 * @returns {boolean} Returns true if added successfully, false otherwise.
 */
AugmentedAST.prototype.addInterface = function (theInterface, index) {
  "use strict";
  //An interface looks like this
  //{type:'interface', name:'In', partial:false, members:[ [Object],[Object] ], inheritance:null, extAttrs:[] },
  // does the dictionary already exist?
  var existingI = this.interfaces[theInterface.name];
  var interfaceMembers = [];
  if (existingI) {
    this.addToExistingInterface(theInterface, index);
  } else {
    // doesn't exist. Add it as a new key.
    this.addNewInterface(theInterface);
  }

  // augment the interface by adding operation fields.

  return true;
};

/**
 * Goes through the queue of types to check, and checks them.
 * @returns {boolean}
 */
AugmentedAST.prototype.processTypeCheckQueue = function () {
  "use strict";
  while (this.typeCheckQueue.length !== 0) {
    if (!this.checkType(this.typeCheckQueue.pop())) {
      throw "Type error";
    }
  }

  return true;
};

/**
 * Iterates over the ast and augments it by calling other methods in this class.
 * @param [ast]
 * @returns {AugmentedAST}
 */
AugmentedAST.prototype.augment = function (ast) {
  "use strict";
  // passing in an ast sets this.ast and starts augmenting
  if (ast) {
    this.ast = ast;
    this.isAugmented = false;
  }

  if (this.isAugmented) {
    return this; //already augmented
  }

  var t = this.ast;
  // note, we visit everything in the TOP level only.
  // this limits the nodes that are supported.
  // the nodes inside are checked in their corresponding methods.
  for (var i = 0; i < t.length; i++) {
    var type = t[i].type;
    if (type === 'interface') { // 3.2
      this.addInterface(t[i], i);
    } else if (type === 'dictionary') { //3.3
      this.addDictionary(t[i], i);
    } else if (type === 'exception') { //3.4
      // TODO Support exceptions
    } else if (type === 'enum') { //3.5
      // TODO Support enums
    } else if (type === 'callback') { //3.6
      // TODO Support callbacks
    } else if (type === 'typedef') { //3.7
      // TODO Support typedefs
    } else if (type === 'implements') { //3.8
      // TODO Support implements
    } else {
      throw "Type not supported at top level: " + t;
    }
  }

  // squash the ast
  var offset = 0;
  for (var iindex = 0; iindex < this.removedIndices.length; iindex++) {
    this.ast.splice(this.removedIndices[iindex] - offset, 1);
    offset++;
  }
  this.removedIndices = [];


  // process the queue
  this.processTypeCheckQueue();

  // return
  this.isAugmented = true;
  this.ast.augmenter = this; // we keep the info we collected in the process.

  return this;
};


// static methods

/**
 * Returns the string type name of a object.
 * Note, if it doesn't matter if it's an array or an operation etc. It returns the most concrete type.
 * E.g. if it's an array of longs, returns long. If it's an operation, returns the operation's return type, etc.
 * @type {Function}
 */
AugmentedAST.getTypeName = AugmentedAST.prototype.getTypeName = function (obj) {
  if (typeof obj == 'string') {
    return obj;
  }

  if (obj.idlType != undefined) {
    return AugmentedAST.prototype.getTypeName(obj.idlType);
  }

  if (obj.type != undefined) {
    return AugmentedAST.prototype.getTypeName(obj.type);
  }

  // base case
  return undefined;
};


AugmentedAST.prototype.idlTypeToSchema = function(idlType){
  if(typeof idlType == 'string'){
    return {"$ref": idlType};
  }

  if(typeof idlType == 'object'){
    if(idlType.sequence && idlType.idlType){
      // todo union types, etc.
      var sequenceDepth = idlType.sequence;
      var sequenceItemType = this.idlTypeToSchema(idlType.idlType);
      return this.idlSequenceToSchema(sequenceDepth, sequenceItemType);
    } else if(idlType.array > 0){
      return {"binary": true};
    } else if(idlType.idlType){
      return this.idlTypeToSchema(idlType.idlType);
    }
  }

  // if we haven't returned yet, there's a case we haven't handled...
  throw new Error("Couldn't handle idl type :" + JSON.stringify(idlType) );

};


AugmentedAST.prototype.idlSequenceToSchema = function(depth, itemType){
  //pre: itemType needs to be a schema...
  if(depth > 0){
    return {
      "type": "array",
      "items": this.idlSequenceToSchema(depth-1, itemType)
    };
  } else {
    return itemType;
  }
};



AugmentedAST.prototype.getInterfaceArray = function(){
  var out = [];
  for(var key in this.interfaces){
    out.push(this.interfaces[key]);
  }

  return out;
};


AugmentedAST.prototype.getDictionaryArray = function(){
  var out = [];
  for(var key in this.dictionaries){
    out.push(this.dictionaries[key]);
  }

  return out;
};

module.exports = AugmentedAST;