// Stitch Bot's mascot, rendered as an actual rigged 3D model (three.js)
// instead of swapped photos. Every arm/finger you see below is a real
// mesh with its own pivot, rotated frame-by-frame -- so "waving",
// "cheering", etc. are genuine joint animation, not image-swapping.
//
// Public API: window.StitchRobot3D.mount(containerEl) / .unmount()
// Safe to call mount() repeatedly (e.g. re-entering the empty chat
// screen); it tears down any previous instance first.
(function () {
  let renderer = null, scene = null, camera = null, container = null;
  let rafId = null, resizeObserver = null;
  let rig = null;
  let poseIndex = 0, poseStartTs = null, poseDuration = 0;
  let blendFrom = null, blending = false, blendStartTs = null;
  const BLEND_MS = 380;

  function makeChromeMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0xd9e4ee, metalness: 1, roughness: 0.18 });
  }
  function makeBodyMaterial() {
    return new THREE.MeshPhysicalMaterial({ color: 0xf5f8fb, metalness: 0.05, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  }
  function makeGlowMaterial(hex) {
    return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.1 });
  }

  // Builds one arm: shoulder -> upperArm -> elbow -> forearm -> wrist -> hand(fingers)
  // Returns pivots so the animator can just set .rotation on each joint.
  function buildArm(side) {
    const chrome = makeChromeMaterial();
    const palmMat = makeBodyMaterial();

    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.74, 0.05, 0.28);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), chrome);
    shoulder.add(shoulderBall);

    const upperArmPivot = new THREE.Group();
    shoulder.add(upperArmPivot);
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.5, 12), chrome);
    upperArm.position.y = -0.25;
    upperArmPivot.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.5;
    upperArmPivot.add(elbow);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 14), chrome);
    elbow.add(elbowBall);

    const forearmPivot = new THREE.Group();
    elbow.add(forearmPivot);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.46, 12), chrome);
    forearm.position.y = -0.23;
    forearmPivot.add(forearm);

    const wrist = new THREE.Group();
    wrist.position.y = -0.46;
    forearmPivot.add(wrist);
    const wristBall = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 14), chrome);
    wrist.add(wristBall);

    const hand = new THREE.Group();
    wrist.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.06), palmMat);
    palm.position.y = -0.1;
    hand.add(palm);

    // Four fingers + thumb, each its own pivot so it can curl independently.
    const fingers = [];
    const fingerCount = 4;
    for (let i = 0; i < fingerCount; i++) {
      const spread = (i - (fingerCount - 1) / 2) * 0.15;
      const pivot = new THREE.Group();
      pivot.position.set(spread, -0.19, 0);
      hand.add(pivot);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.15, 6), chrome);
      seg.position.y = -0.075;
      pivot.add(seg);
      fingers.push(pivot);
    }
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(side * 0.1, -0.12, 0.03);
    thumbPivot.rotation.z = side * 0.9;
    hand.add(thumbPivot);
    const thumbSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.015, 0.11, 6), chrome);
    thumbSeg.position.y = -0.055;
    thumbPivot.add(thumbSeg);

    return { shoulder, upperArmPivot, elbow, forearmPivot, wrist, hand, fingers, thumbPivot };
  }

  function buildRig() {
    const root = new THREE.Group();

    // Foot ball (white top, dark underside) on a chrome neck.
    const footMat = makeBodyMaterial();
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 24), footMat);
    foot.position.y = 0;
    root.add(foot);
    const footCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.345, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.5, metalness: 0.2 })
    );
    root.add(footCap);
    const footDot = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), makeGlowMaterial(0x2f8fff));
    footDot.position.set(0, 0.05, 0.335);
    root.add(footDot);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.5, 12), makeChromeMaterial());
    neck.position.y = 0.58;
    root.add(neck);
    const neckJoint = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), makeChromeMaterial());
    neckJoint.position.y = 0.84;
    root.add(neckJoint);

    const headPivot = new THREE.Group();
    headPivot.position.y = 1.35;
    root.add(headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 36, 36), makeBodyMaterial());
    headPivot.add(head);

    const eyeDisc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 40), new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.15, metalness: 0.3 }));
    eyeDisc.position.z = 0.78;
    headPivot.add(eyeDisc);
    const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.022, 10, 48), makeGlowMaterial(0x2f8fff));
    eyeRing.position.z = 0.78;
    headPivot.add(eyeRing);
    const eyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), makeGlowMaterial(0x6cc2ff));
    eyePupil.position.z = 0.98;
    headPivot.add(eyePupil);
    const eyeLight = new THREE.PointLight(0x3aa0ff, 1.1, 4);
    eyeLight.position.z = 1.1;
    headPivot.add(eyeLight);

    const armL = buildArm(-1);
    const armR = buildArm(1);
    headPivot.add(armL.shoulder, armR.shoulder);

    return { root, headPivot, armL, armR };
  }

  // --- Six procedural animations. Each returns a "values" object the
  // animator applies directly to the rig's joints every frame. ---
  function fingerCurl(pivots, amount) { pivots.forEach(p => (p.rotation.x = amount)); }

  const POSES = [
    { key: 'wave-fingers', fn(t) { return {
      rootY: Math.sin(t * 1.3) * 0.05, rootRot: Math.sin(t * 0.7) * 0.03, footSquash: 0,
      headTiltX: 0, headTiltZ: Math.sin(t * 0.9) * 0.04,
      armR: { shX: 0.25, shZ: -2.0, elX: 0.5, wrZ: Math.sin(t * 4) * 0.4, curl: 0.35 + Math.sin(t * 5) * 0.2 },
      armL: { shX: Math.sin(t * 1.1) * 0.15, shZ: 0.15, elX: 0.15, wrZ: 0, curl: 0.1 },
    }; } },
    { key: 'wave-open', fn(t) { return {
      rootY: Math.abs(Math.sin(t * 1.8)) * 0.09, rootRot: 0, footSquash: Math.abs(Math.sin(t * 1.8)) * 0.05,
      headTiltX: 0, headTiltZ: Math.sin(t * 1.8) * 0.05,
      armR: { shX: 0.15 + Math.sin(t * 2.2) * 0.35, shZ: -2.05, elX: 0.2, wrZ: 0, curl: 0 },
      armL: { shX: 0.5, shZ: 0.35, elX: 0.4, wrZ: 0, curl: 0.2 },
    }; } },
    { key: 'leap', fn(t) { const p = (t % 1.1) / 1.1, hop = Math.sin(p * Math.PI); return {
      rootY: hop * 0.5, rootRot: Math.sin(t * 3) * 0.08, footSquash: -hop * 0.15,
      headTiltX: -hop * 0.12, headTiltZ: Math.sin(t * 2) * 0.05,
      armR: { shX: -0.6 - hop * 0.4, shZ: -0.7, elX: -0.5, wrZ: 0, curl: 0.15 },
      armL: { shX: -0.6 - hop * 0.4, shZ: 0.7, elX: -0.5, wrZ: 0, curl: 0.15 },
    }; } },
    { key: 'point', fn(t) { return {
      rootY: Math.sin(t * 1.1) * 0.03, rootRot: 0, footSquash: 0,
      headTiltX: 0.05, headTiltZ: Math.sin(t * 0.6) * 0.08,
      armR: { shX: 1.05, shZ: -0.5, elX: 1.85, wrZ: 0, curl: 0, curlIndex: 0, curlOthers: 1.3 },
      armL: { shX: Math.sin(t * 0.8) * 0.1, shZ: 0.1, elX: 0.1, wrZ: 0, curl: 0.15 },
    }; } },
    { key: 'cheer-open', fn(t) { const p = (t % 0.6) / 0.6, hop = Math.sin(p * Math.PI); return {
      rootY: hop * 0.22, rootRot: Math.sin(t * 6) * 0.04, footSquash: -hop * 0.07,
      headTiltX: 0, headTiltZ: Math.sin(t * 5) * 0.03,
      armR: { shX: 0.1, shZ: -2.7, elX: 0.1, wrZ: 0, curl: 0 },
      armL: { shX: 0.1, shZ: 2.7, elX: 0.1, wrZ: 0, curl: 0 },
    }; } },
    { key: 'cheer-fist', fn(t) { const p = (t % 0.5) / 0.5, hop = Math.abs(Math.sin(p * Math.PI)); return {
      rootY: hop * 0.16, rootRot: 0, footSquash: -hop * 0.05,
      headTiltX: 0, headTiltZ: Math.sin(t * 8) * 0.03,
      armR: { shX: 0.05, shZ: -2.5 + Math.sin(t * 8) * 0.12, elX: 0.05, wrZ: 0, curl: 1.5 },
      armL: { shX: 0.05, shZ: 2.5 + Math.sin(t * 8 + Math.PI) * 0.12, elX: 0.05, wrZ: 0, curl: 1.5 },
    }; } },
  ];

  function lerp(a, b, f) { return a + (b - a) * f; }
  function lerpArm(a, b, f) {
    return {
      shX: lerp(a.shX, b.shX, f), shZ: lerp(a.shZ, b.shZ, f), elX: lerp(a.elX, b.elX, f),
      wrZ: lerp(a.wrZ, b.wrZ, f), curl: lerp(a.curl, b.curl, f),
      curlIndex: lerp(a.curlIndex ?? a.curl, b.curlIndex ?? b.curl, f),
      curlOthers: lerp(a.curlOthers ?? a.curl, b.curlOthers ?? b.curl, f),
    };
  }
  function lerpValues(a, b, f) {
    return {
      rootY: lerp(a.rootY, b.rootY, f), rootRot: lerp(a.rootRot, b.rootRot, f), footSquash: lerp(a.footSquash, b.footSquash, f),
      headTiltX: lerp(a.headTiltX, b.headTiltX, f), headTiltZ: lerp(a.headTiltZ, b.headTiltZ, f),
      armR: lerpArm(a.armR, b.armR, f), armL: lerpArm(a.armL, b.armL, f),
    };
  }

  function applyArm(armRig, side, v) {
    armRig.upperArmPivot.rotation.x = v.shX;
    armRig.shoulder.rotation.z = v.shZ * side;
    armRig.elbow.rotation.x = v.elX;
    armRig.wrist.rotation.z = v.wrZ;
    if (v.curlIndex !== undefined && v.curlOthers !== undefined && (v.curlIndex !== v.curl || v.curlOthers !== v.curl)) {
      fingerCurl([armRig.fingers[0]], v.curlIndex);
      fingerCurl(armRig.fingers.slice(1), v.curlOthers);
    } else {
      fingerCurl(armRig.fingers, v.curl);
    }
    armRig.thumbPivot.rotation.x = v.curl * 0.7;
  }

  function applyValues(v) {
    rig.root.position.y = v.rootY;
    rig.root.rotation.y = v.rootRot;
    rig.root.scale.set(1 - v.footSquash * 0.4, 1 + v.footSquash, 1 - v.footSquash * 0.4);
    rig.headPivot.rotation.x = v.headTiltX;
    rig.headPivot.rotation.z = v.headTiltZ;
    applyArm(rig.armR, 1, v.armR);
    applyArm(rig.armL, -1, v.armL);
  }

  function pickNextPoseIndex() {
    if (POSES.length < 2) return 0;
    let next;
    do { next = Math.floor(Math.random() * POSES.length); } while (next === poseIndex);
    return next;
  }
  function randomPoseDuration() { return 3.4 + Math.random() * 1.6; }

  function animate(ts) {
    rafId = requestAnimationFrame(animate);
    if (!rig) return;
    if (poseStartTs === null) poseStartTs = ts;
    const poseT = (ts - poseStartTs) / 1000;

    if (poseT >= poseDuration && !blending) {
      blending = true;
      blendStartTs = ts;
      blendFrom = POSES[poseIndex].fn(poseT);
      poseIndex = pickNextPoseIndex();
      poseStartTs = ts; // next pose's own clock starts now
    }

    if (blending) {
      const bf = Math.min(1, (ts - blendStartTs) / BLEND_MS);
      const toVals = POSES[poseIndex].fn((ts - poseStartTs) / 1000);
      applyValues(lerpValues(blendFrom, toVals, bf));
      if (bf >= 1) { blending = false; poseDuration = randomPoseDuration(); }
    } else {
      applyValues(POSES[poseIndex].fn(poseT));
    }

    renderer.render(scene, camera);
  }

  function resize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || 130, h = container.clientHeight || 130;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function mount(containerEl) {
    unmount();
    if (typeof THREE === 'undefined' || !containerEl) return;
    container = containerEl;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.15, 6.4);
    camera.lookAt(0, 0.75, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    resize();

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfdcff, 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    rig = buildRig();
    scene.add(rig.root);

    poseIndex = Math.floor(Math.random() * POSES.length);
    poseStartTs = null;
    poseDuration = randomPoseDuration();
    blending = false;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }

    rafId = requestAnimationFrame(animate);
  }

  function unmount() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (resizeObserver && container) { resizeObserver.disconnect(); resizeObserver = null; }
    else { window.removeEventListener('resize', resize); }
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); renderer = null; }
    scene = null; camera = null; rig = null; container = null;
    poseStartTs = null; blending = false;
  }

  window.StitchRobot3D = { mount, unmount };
})();
