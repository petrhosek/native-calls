// Copyright (c) 2013 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var container, stats;
var camera, controls, scene, projector, renderer;
var plane;
var lastSceneDescription;
var skipSceneUpdates = 0;
var hold = false;
var holdObjectIndex = -1;

var mouse = new THREE.Vector2();
var offset = new THREE.Vector3();
var INTERSECTED, SELECTED;

var sceneDescription = [];

var shapes = {};
var objects = [];

function clearWorld() {
  for (var i = 0; i < objects.length; i++) {
    scene.remove(objects[i]);
  }
  objects = [];
  shapes = {};
  // Make sure we drop the object.
  hold = false;
  SELECTED = undefined;
  bullet.BulletInterface.DropObject();
}

function loadShape(shape, rpcScene) {
  if (shapes[shape.name] != undefined) {
    return shapes[shape.name];
  }

  if (shape.type == "cube") {
    rpcScene.cubes.push(shape);
    shapes[shape.name] = new THREE.CubeGeometry(shape['wx'], shape['wy'], shape['wz']);
    return shapes[shape.name];
  }

  if (shape.type == "convex") {
    var rpcConvex = {name: shape.name, points: []};
    var vertices = [];
    for (var i = 0; i < shape['points'].length; i++) {
      var currentShapePoints = shape['points'][i];
      rpcConvex.points.push({x:currentShapePoints[0], y:currentShapePoints[1], z:currentShapePoints[2]});
      vertices.push(new THREE.Vector3(currentShapePoints[0], currentShapePoints[1], currentShapePoints[2]));
    }
    rpcScene.convices.push(rpcConvex);
    shapes[shape.name] = new THREE.ConvexGeometry(vertices);
    return shapes[shape.name];
  }

  if (shape.type == "cylinder") {
    rpcScene.cylinders.push(shape);
    shapes[shape.name] = new THREE.CylinderGeometry(shape['radius'], shape['radius'], shape['height'])
      return shapes[shape.name];
  }

  if (shape.type == "sphere") {
    rpcScene.spheres.push(shape);
    shapes[shape.name] = new THREE.SphereGeometry(shape['radius']);
    return shapes[shape.name];
  }

  return undefined;
}

function loadBody(body, rpcScene) {
  var rpcBody = {
    shapeName: body.shape,
    mass: body.mass,
    friction: body.friction,
    transform: []
  };
  var shape = shapes[body.shape];
  if (shape == undefined) {
    return shape;
  }

  var object = new THREE.Mesh( shape, new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } ) );

  object.material.ambient = object.material.color;

  object.position.x = body.position.x;
  object.position.y = body.position.y;
  object.position.z = body.position.z;

  object.rotation.x = body.rotation.x;
  object.rotation.y = body.rotation.y;
  object.rotation.z = body.rotation.z;

  object.updateMatrixWorld(true);
  var T = [object.matrixWorld.elements[0],
      object.matrixWorld.elements[1],
      object.matrixWorld.elements[2],
      object.matrixWorld.elements[3],
      object.matrixWorld.elements[4],
      object.matrixWorld.elements[5],
      object.matrixWorld.elements[6],
      object.matrixWorld.elements[7],
      object.matrixWorld.elements[8],
      object.matrixWorld.elements[9],
      object.matrixWorld.elements[10],
      object.matrixWorld.elements[11],
      object.matrixWorld.elements[12],
      object.matrixWorld.elements[13],
      object.matrixWorld.elements[14],
      object.matrixWorld.elements[15]];
  body.transform = T;
  rpcBody.transform = T;

  object.castShadow = false;
  object.receiveShadow = false;
  object.matrixAutoUpdate = false;
  object.objectTableIndex = objects.length;
  scene.add(object);
  objects.push(object);
  rpcScene.bodies.push(rpcBody); 
  return object;
}

function loadWorld(worldDescription, callback ) {
  clearWorld();
  var i;
  var rpcScene = {
    cubes: [],
    convices: [],
    spheres: [],
    cylinders: [],
    bodies: []
  };
  var shapes = worldDescription['shapes'];
  var bodies = worldDescription['bodies'];
  for (i = 0; i < shapes.length; i++) {
    if (loadShape(shapes[i], rpcScene) == undefined) {
      console.log('Could not load shape ' + shapes[i].name);
    }
  }

  for (i = 0; i < bodies.length; i++) {
    if (loadBody(bodies[i], rpcScene) == undefined) {
      console.log('Could not make body.');
    }
  }

  skipSceneUpdates = 4;
  bullet.BulletInterface.LoadScene(rpcScene, function(result){
    console.log("Scene loaded "+ result);
    if(callback)callback();
  });
  lastSceneDescription = worldDescription;
}

function reloadScene() {
  if (lastSceneDescription)
    loadWorld(lastSceneDescription);
}

function init() {
  var rendererContainer = document.getElementById('rendererContainer');
  var rcW = rendererContainer.clientWidth;
  var rcH = rendererContainer.clientHeight;

  camera = new THREE.PerspectiveCamera(
      70,
      rcW / rcH, 1, 10000);
  camera.position.y = 20.0;
  camera.position.z = 40;

  scene = new THREE.Scene();

  scene.add( new THREE.AmbientLight( 0x505050 ) );

  var light = new THREE.SpotLight( 0xffffff, 1.5 );
  light.position.set( 0, 500, 2000 );
  light.castShadow = true;

  light.shadowCameraNear = 200;
  light.shadowCameraFar = camera.far;
  light.shadowCameraFov = 50;

  light.shadowBias = -0.00022;
  light.shadowDarkness = 0.5;

  light.shadowMapWidth = 2048;
  light.shadowMapHeight = 2048;

  scene.add( light );

  plane = new THREE.Mesh( new THREE.PlaneGeometry( 200, 200, 100, 100), new THREE.MeshBasicMaterial( { color: 0x000000, opacity: 0.25, transparent: true, wireframe: true } ) );
  plane.rotation.x = Math.PI * 0.5;
  plane.visible = true;
  scene.add( plane );
  projector = new THREE.Projector();

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.sortObjects = false;
  renderer.setSize( rcW, rcH );
  lastRendererWidth = rcW;
  lastRendererHeight = rcH;

  renderer.shadowMapEnabled = true;
  renderer.shadowMapSoft = true;

  rendererContainer.appendChild(renderer.domElement);

  var idFuncHash = {
    jenga10: loadJenga10,
    jenga20: loadJenga20,
    randomShapes: loadRandomShapes,
    randomCube250: load250RandomCubes,
    randomCylinder500: load500RandomCylinders,
    randomCube1000: load1000RandomCubes,
    randomCube2000: load2000RandomCubes
  };

  document.getElementById('scene').addEventListener('change', function() {
    var scene = this.value;
    var func = idFuncHash[scene];
    if (func)
      func();
  }, false);
  document.getElementById('reload').addEventListener('click', reloadScene, false);

  rendererContainer.addEventListener('mousedown', onMouseDown, false);
  rendererContainer.addEventListener('mouseup', onMouseUp, false);
  rendererContainer.addEventListener('mouseleave', onMouseUp, false);
  renderer.domElement.addEventListener('mousemove', onMouseMove, false);

  // Add the OrbitControls after our own listeners -- that way we can prevent
  // the camera rotation when dragging an object.
  controls = new THREE.OrbitControls(camera, rendererContainer);

  window.setInterval(pollForRendererResize, 10);
}

function pollForRendererResize() {
  var rendererContainer = document.getElementById('rendererContainer');
  var w = rendererContainer.clientWidth;
  var h = rendererContainer.clientHeight;
  if (w == lastRendererWidth && h == lastRendererHeight)
    return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize( w, h );
  lastRendererWidth = w;
  lastRendererHeight = h;
}

function onMouseDown(event) {
  event.preventDefault();

  var vector = new THREE.Vector3( mouse.x, mouse.y, 0.5 );
  projector.unprojectVector( vector, camera );
  var ray = new THREE.Ray( camera.position, vector.subSelf( camera.position ).normalize() );
  var intersects = ray.intersectObjects( objects );
  if (intersects.length > 0) {
    var intersects0 = intersects[0];
    if (intersects0.object != plane) {
      hold = true;
      SELECTED = intersects0.object;
      //console.log(SELECTED.objectTableIndex);
      bullet.BulletInterface.PickObject(SELECTED.objectTableIndex, intersects0.point, camera.position, function(){
        console.log("Picked object");
      });
      // stopImmediatePropagation() will prevent other event listeners on the
      // same element from firing -- in this case, the OrbitControls camera
      // rotation.
      event.stopImmediatePropagation();
    }
  }
}

function onMouseUp(event) {
  if (hold) {
    hold = false;
    SELECTED = undefined;
    bullet.BulletInterface.DropObject(function(){console.log("Dropped Object")});
    event.stopImmediatePropagation();
  }
}

function onMouseMove( event ) {
  event.preventDefault();

  var clientRect = document.getElementById('rendererContainer').getClientRects()[0];
  var x = event.clientX - clientRect.left;
  var y = event.clientY - clientRect.top;
  var w = clientRect.width;
  var h = clientRect.height;

  mouse.x = ( x / w ) * 2 - 1;
  mouse.y = -( y / h ) * 2 + 1;
  var vector = new THREE.Vector3( mouse.x, mouse.y, 0.5 );
  projector.unprojectVector( vector, camera );
  offset.x = vector.x;
  offset.y = vector.y;
  offset.z = vector.z;
}

//

function animate() {
  window.requestAnimationFrame(animate);
  var start = (new Date()).getTime();
  bullet.BulletInterface.StepScene(camera.position, offset, function(sceneUpdate){
      NCStats.total_tripTime += (new Date()).getTime() - start;
      NCStats.num_trips++;
      NCStats.num_sims++;
      NCStats.total_simTime += sceneUpdate.delta;

      var transformBuffer = sceneUpdate.transform;
      document.getElementById('simulationTime').innerHTML = sceneUpdate.delta;
      if (skipSceneUpdates > 0) {
        skipSceneUpdates--;
        return;
      }
      var numTransforms = transformBuffer.length / 16;
      for (var i = 0; i < numTransforms; i++) {
        if(objects[i]){
          for (var j = 0; j < 16; j++) {
            if(objects[i].matrixWorld){
              objects[i].matrixWorld.elements[j] = transformBuffer[i*16+j];
            }
          }
        }
      }
  });
  render();
}

function render() {
  NCStats.frames++;
  controls.update();
  renderer.render( scene, camera );
}
