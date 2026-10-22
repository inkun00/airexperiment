/**
 * scene3d.js
 * Three.js 기반 '오르락내리락 오징어 장난감' 3D 물리/조립 시뮬레이션 엔진
 */

class SquidExperiment3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    // 상태 변수
    this.state = {
      labStep: 1,
      isBent: false,
      bendAnim: 0,       // 0: 펴짐 -> 1: U자 구부림
      isCut: false,
      cutAnim: 0,
      isTaped: false,
      tapeAnim: 0,
      isClipsHooked: false,
      isClipInserted: false,
      insertAnim: 0,
      hangingClipCount: 3,
      isInBottle: false,
      isCapClosed: false,
      capAnim: 0,
      squeeze: 0,        // 0.0 ~ 1.0 (현재 페트병 누르는 정도)
      targetSqueeze: 0,
      // 물리 시뮬레이션 변수 (보일의 법칙 · 파스칼의 원리 · 아르키메데스 부력 · 유체 연속 방정식)
      squidY: 1.55,            // 물속 오징어 높이 (물 표면 근처 ~ 바닥)
      squidVy: 0,
      waterTopY: 2.80,         // 페트병 내부 현재 수면 높이
      spilledVolume: 0,        // 뚜껑을 안 닫고 눌러서 밖으로 쏟아진 물의 부피
      isOverflowing: false,    // 현재 병 입구로 물이 넘치고 있는지 여부
      hasSpilledFailure: false,// 물이 쏟아져 실험이 망가진 상태 여부
      headspacePressureAtm: 1.0, // 병 상단 공기층 압력 (atm)
      totalPressureAtm: 1.0,   // 빨대 내부 공기가 받는 총 절대압력 (atm)
      waterInStrawRatio: 0.0,  // 빨대 내부에 물이 들어온 비율 (0.0 ~ 0.65)
      airVolumeRatio: 1.0,     // 빨대 내부 공기 부피 비율 (1.0 = 100% 기준)
      totalMassGrams: 2.37,    // 오징어+클립 총 질량 (g)
      submergedVolCm3: 2.37,   // 물에 잠긴 총 배수 부피 (cm^3)
      netBuoyancyGf: 0.0       // 알짜 부력 (부력 - 중력, gf)
    };

    // 3D 그룹 참조
    this.squidGroup = null;
    this.strawGroup = null;
    this.longLegTipGroup = null;
    this.cutoffPieceMesh = null;
    this.tapeMesh = null;
    this.strawDecalMesh = null;
    this.internalWaterLeft = null;
    this.internalWaterRight = null;
    this.internalAirLeft = null;
    this.internalAirRight = null;
    this.internalAirArch = null;
    this.strawMeniscusL = null;
    this.strawMeniscusR = null;
    this.strawFlowDrops = [];

    this.clipsAssemblyGroup = null;
    this.mainSilverClip = null;
    this.hangingClipsGroup = null;

    this.scissorsGroup = null;
    this.scissorsBladeL = null;
    this.scissorsBladeR = null;
    this.scissorsTimer = 0;

    this.bottleGroup = null;
    this.bottleBodyGeo = null;
    this.bottleOrigPositions = null;
    this.bottleWaterMesh = null;
    this.bottleCapMesh = null;
    this.bottleDecoMesh = null;
    this.squeezeHandL = null;
    this.squeezeHandR = null;
    this.bubblesGroup = null;
    this.bubblesData = [];

    // 물 넘침(뚜껑 미밀폐 시 실험 실패) 3D 파티클 및 물웅덩이 참조
    this.spillGroup = null;
    this.overflowLipMesh = null;
    this.puddleMesh = null;
    this.puddleRimMesh = null;
    this.spillDrops = [];
    this.initialWaterVolume = 0;

    // 캔버스 텍스처 참조
    this.strawCanvasTexture = null;
    this.bottleCanvasTexture = null;

    this.isPointerDownOnBottle = false;
    this.onDirectSqueezeChange = null;
    this.onSpillStateChange = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 700;
    const height = this.container.clientHeight || 560;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.set(0, 2.3, 8.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.3, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 13;

    this.setupLights();
    this.buildDeskSurface();
    this.buildSquidToy();
    this.buildScissors();
    this.buildPETBottle();
    this.setupDirectBottleInteraction();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.88);
    this.scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
    sunLight.position.set(5, 9, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.85);
    rimLight.position.set(-6, 5, -5);
    this.scene.add(rimLight);

    const frontFill = new THREE.PointLight(0xffffff, 0.6, 18);
    frontFill.position.set(0, 3.5, 5);
    this.scene.add(frontFill);
  }

  buildDeskSurface() {
    // 어두운 과학 실험실 책상(다크 차콜/슬레이트 텍스처) 생성
    const deskCanvas = document.createElement('canvas');
    deskCanvas.width = 512;
    deskCanvas.height = 512;
    const ctx = deskCanvas.getContext('2d');
    ctx.fillStyle = '#181e29';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(15, 23, 42, 0.35)' : 'rgba(51, 65, 85, 0.16)';
      const y = (i / 80) * 512;
      ctx.fillRect(0, y, 512, 3 + Math.sin(i) * 2);
    }
    const deskTex = new THREE.CanvasTexture(deskCanvas);

    const tableGeo = new THREE.CylinderGeometry(5.8, 5.8, 0.28, 64);
    const tableMat = new THREE.MeshStandardMaterial({
      map: deskTex,
      color: 0x1e293b,
      roughness: 0.68,
      metalness: 0.12
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -0.15;
    tableMesh.receiveShadow = true;
    this.scene.add(tableMesh);
  }

  /**
   * 실제 주름 빨대 + 셀로판테이프 + 내부 공기/물 기둥 + 클립 조립체 생성
   */
  buildSquidToy() {
    this.squidGroup = new THREE.Group();
    this.squidGroup.position.set(-1.35, 2.25, 0.6);
    this.scene.add(this.squidGroup);

    this.strawGroup = new THREE.Group();
    this.squidGroup.add(this.strawGroup);

    // 반투명 주름 빨대 재질 (내부 공기 기둥의 압축과 물 유입이 한눈에 선명히 투시되도록 투명도 최적화)
    const strawMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.28,
      roughness: 0.12,
      transmission: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const strawRadius = 0.095;
    const archRadius = 0.23; // U자 굽힘 반경

    // 1) 오른쪽 짧은 쪽 다리 (x = +archRadius, 길이 1.05)
    const shortLegGeo = new THREE.CylinderGeometry(strawRadius, strawRadius, 1.05, 24, 1, true);
    this.shortLegMesh = new THREE.Mesh(shortLegGeo, strawMat);
    this.shortLegMesh.position.set(archRadius, -0.525, 0);
    this.strawGroup.add(this.shortLegMesh);

    // 2) 주름 마디 (위쪽 U자 아치 부분 - 주름 링 12개로 사실적 표현)
    this.bellowsGroup = new THREE.Group();
    this.strawGroup.add(this.bellowsGroup);

    const numRings = 12;
    this.bellowRings = [];
    for (let i = 0; i <= numRings; i++) {
      const ringGeo = new THREE.TorusGeometry(strawRadius * 1.04, 0.020, 10, 24);
      const ringMesh = new THREE.Mesh(ringGeo, strawMat);
      this.bellowsGroup.add(ringMesh);
      this.bellowRings.push(ringMesh);
    }

    // 3) 왼쪽 긴 쪽 다리 윗부분 (짧은 쪽과 동일한 길이 1.05)
    this.longLegUpperGroup = new THREE.Group();
    this.strawGroup.add(this.longLegUpperGroup);

    const longUpperGeo = new THREE.CylinderGeometry(strawRadius, strawRadius, 1.05, 24, 1, true);
    const longUpperMesh = new THREE.Mesh(longUpperGeo, strawMat);
    longUpperMesh.position.set(0, -0.525, 0);
    this.longLegUpperGroup.add(longUpperMesh);

    // 4) 왼쪽 긴 쪽 다리의 '잘려 나갈 아랫부분' (길이 0.72)
    const cutoffGeo = new THREE.CylinderGeometry(strawRadius, strawRadius, 0.72, 24, 1, true);
    this.cutoffPieceMesh = new THREE.Mesh(cutoffGeo, strawMat.clone());
    this.cutoffPieceMesh.position.set(0, -1.05 - 0.36, 0);
    this.longLegUpperGroup.add(this.cutoffPieceMesh);

    // 5) 셀로판테이프 (1-3단계에서 빨대 두 다리 둘레에 감김)
    const tapeShape = new THREE.Shape();
    tapeShape.absarc(-archRadius, 0, strawRadius + 0.014, Math.PI * 0.5, Math.PI * 1.5, false);
    tapeShape.absarc(archRadius, 0, strawRadius + 0.014, -Math.PI * 0.5, Math.PI * 0.5, false);
    tapeShape.closePath();

    const extrudeSettings = { depth: 0.28, bevelEnabled: false, curveSegments: 24 };
    const tapeGeo = new THREE.ExtrudeGeometry(tapeShape, extrudeSettings);
    tapeGeo.rotateX(Math.PI / 2);
    const tapeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
    this.tapeMesh.position.set(0, -0.18, 0);
    this.tapeMesh.visible = false;
    this.strawGroup.add(this.tapeMesh);

    // 6) 유성펜 드로잉이 매핑될 오징어 몸통 곡면 데칼 메쉬 (빨대 아랫부분 공기·물 경계가 잘 보이도록 상단 배치)
    const decalGeo = new THREE.PlaneGeometry(0.62, 0.65);
    this.strawDecalMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.strawDecalMesh = new THREE.Mesh(decalGeo, this.strawDecalMat);
    this.strawDecalMesh.position.set(0, -0.24, strawRadius + 0.018);
    this.strawGroup.add(this.strawDecalMesh);

    // 7) 빨대 내부의 포집된 공기 기둥(밝은 노란빛 기체) & 압력에 의해 밀려 들어오는 물 기둥(선명한 청록·파란색)
    const innerWaterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.94,
      roughness: 0.08
    });
    const innerAirMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.58,
      transparent: true,
      opacity: 0.86,
      roughness: 0.15
    });

    const innerCylGeo = new THREE.CylinderGeometry(strawRadius * 0.78, strawRadius * 0.78, 1.0, 20);
    this.internalWaterLeft = new THREE.Mesh(innerCylGeo, innerWaterMat);
    this.internalWaterRight = new THREE.Mesh(innerCylGeo, innerWaterMat);
    this.internalAirLeft = new THREE.Mesh(innerCylGeo, innerAirMat);
    this.internalAirRight = new THREE.Mesh(innerCylGeo, innerAirMat);

    // 빨대 상단 U자 아치 내부의 공기 기둥
    const archAirGeo = new THREE.TorusGeometry(archRadius, strawRadius * 0.75, 14, 28, Math.PI);
    this.internalAirArch = new THREE.Mesh(archAirGeo, innerAirMat);
    this.internalAirArch.visible = false;
    this.strawGroup.add(this.internalAirArch);

    // 빨대 내부 공기-물 경계면(메니스커스 링) - 압력에 따라 오르내리는 경계를 선명하게 표시
    const meniscusRingGeo = new THREE.CylinderGeometry(strawRadius * 0.84, strawRadius * 0.84, 0.036, 20);
    const meniscusRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    this.strawMeniscusL = new THREE.Mesh(meniscusRingGeo, meniscusRingMat);
    this.strawMeniscusR = new THREE.Mesh(meniscusRingGeo, meniscusRingMat);
    this.strawMeniscusL.visible = false;
    this.strawMeniscusR.visible = false;
    this.strawGroup.add(this.strawMeniscusL);
    this.strawGroup.add(this.strawMeniscusR);

    // 빨대 하단 구멍으로 물과 압력이 유입/유출되는 흐름 입자
    this.strawFlowDrops = [];
    const flowDropGeo = new THREE.SphereGeometry(0.028, 10, 10);
    const flowDropMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.9
    });
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(flowDropGeo, flowDropMat);
      drop.visible = false;
      this.strawGroup.add(drop);
      this.strawFlowDrops.push({
        mesh: drop,
        legSign: i % 2 === 0 ? -1 : 1,
        phase: (i / 8)
      });
    }

    this.internalWaterLeft.visible = false;
    this.internalWaterRight.visible = false;
    this.internalAirLeft.visible = false;
    this.internalAirRight.visible = false;

    this.strawGroup.add(this.internalWaterLeft);
    this.strawGroup.add(this.internalWaterRight);
    this.strawGroup.add(this.internalAirLeft);
    this.strawGroup.add(this.internalAirRight);

    // 8) 클립 어셈블리 (2단계)
    this.clipsAssemblyGroup = new THREE.Group();
    // 처음에는 빨대 아래쪽에 대기 (책상 위에서 선명하게 보이도록 위치 조정)
    this.clipsAssemblyGroup.position.set(0, -1.35, 0);
    this.clipsAssemblyGroup.visible = false;
    this.squidGroup.add(this.clipsAssemblyGroup);

    // 첫 번째 은색 클립 (양 끝이 빨대의 두 구멍에 끼워지는 클립)
    this.mainSilverClip = this.createPaperclipMesh(0xf1f5f9, true);
    this.clipsAssemblyGroup.add(this.mainSilverClip);

    // 아래에 매달리는 오징어 다리 색깔 클립들 그룹
    this.hangingClipsGroup = new THREE.Group();
    this.hangingClipsGroup.position.set(0, -0.30, 0);
    this.clipsAssemblyGroup.add(this.hangingClipsGroup);

    this.rebuildHangingClips(3);
    this.updateStrawBendGeometry(0);
  }

  /**
   * 실제 클립 형태의 3D TubeGeometry 생성
   */
  createPaperclipMesh(hexColor, isMainConnector = false) {
    let points;
    if (isMainConnector) {
      // 빨대 두 구멍(-0.23, +0.23)에 양쪽 다리가 들어가는 U+루프 클립 형상
      points = [
        new THREE.Vector3(-0.23, 0.35, 0),
        new THREE.Vector3(-0.23, -0.28, 0),
        new THREE.Vector3(-0.12, -0.35, 0),
        new THREE.Vector3(0.12, -0.35, 0),
        new THREE.Vector3(0.23, -0.28, 0),
        new THREE.Vector3(0.23, 0.32, 0),
        new THREE.Vector3(0.15, 0.36, 0.015),
        new THREE.Vector3(0.15, -0.22, 0.015)
      ];
    } else {
      // 세로로 매달리는 전형적인 오징어 다리 클립 형상
      points = [
        new THREE.Vector3(-0.04, 0.02, 0),
        new THREE.Vector3(-0.08, -0.02, 0),
        new THREE.Vector3(-0.09, -0.58, 0),
        new THREE.Vector3(0.0, -0.66, 0),
        new THREE.Vector3(0.09, -0.58, 0),
        new THREE.Vector3(0.08, 0.02, 0),
        new THREE.Vector3(0.0, 0.08, 0.01),
        new THREE.Vector3(-0.06, 0.02, 0.01),
        new THREE.Vector3(-0.05, -0.45, 0.01),
        new THREE.Vector3(0.04, -0.45, 0.01),
        new THREE.Vector3(0.04, -0.1, 0.01)
      ];
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 44, 0.024, 12, false);
    const mat = new THREE.MeshStandardMaterial({
      color: hexColor,
      emissive: hexColor,
      emissiveIntensity: 0.22,
      metalness: isMainConnector ? 0.65 : 0.25,
      roughness: 0.25
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  /**
   * 매달린 다리 클립 개수(1~6개) 재구성
   */
  rebuildHangingClips(count) {
    this.state.hangingClipCount = count;
    while (this.hangingClipsGroup.children.length > 0) {
      this.hangingClipsGroup.remove(this.hangingClipsGroup.children[0]);
    }

    const palette = [0xef4444, 0x0ea5e9, 0xeab308, 0x22c55e, 0xa855f7, 0xf97316];
    const spacing = 0.095;
    const startX = -((count - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const clipMesh = this.createPaperclipMesh(palette[i % palette.length], false);
      clipMesh.position.set(startX + i * spacing, 0, (i % 2 === 0 ? 1 : -1) * 0.015);
      clipMesh.rotation.z = (i - (count - 1) / 2) * 0.08;
      this.hangingClipsGroup.add(clipMesh);
    }
  }

  /**
   * 주름 빨대 구부리기 애니메이션(t: 0 펴짐 -> 1 180도 U자 구부림)
   */
  updateStrawBendGeometry(t) {
    const archRadius = 0.23;
    // t=0일 때는 약간만 꺾인 상태(35도), t=1일 때는 완전히 180도(PI) 구부러진 U자
    const totalAngle = THREE.MathUtils.lerp(Math.PI * 0.18, Math.PI, t);
    const numRings = this.bellowRings.length - 1;

    for (let i = 0; i <= numRings; i++) {
      const frac = i / numRings;
      const theta = frac * totalAngle;
      // 오른쪽 다리 꼭대기(x = +archRadius, y = 0)를 시작점으로 반원 아치 형성
      const cx = archRadius - archRadius * (1 - Math.cos(theta));
      const cy = archRadius * Math.sin(theta);
      const ring = this.bellowRings[i];
      ring.position.set(cx, cy, 0);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = theta;
    }

    // 아치 끝점에 왼쪽 긴 다리 연결
    const endX = archRadius - archRadius * (1 - Math.cos(totalAngle));
    const endY = archRadius * Math.sin(totalAngle);
    this.longLegUpperGroup.position.set(endX, endY, 0);
    // totalAngle = PI일 때 회전각이 0이 되어 아래(-Y)를 향함
    this.longLegUpperGroup.rotation.z = totalAngle - Math.PI;
  }

  /**
   * 3D 안전가위 모델 생성 (1-2단계 빨대 자르기 연출용)
   */
  buildScissors() {
    this.scissorsGroup = new THREE.Group();
    this.scissorsGroup.position.set(-2.2, 0.3, 1.0);
    this.scissorsGroup.visible = false;
    this.scene.add(this.scissorsGroup);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });

    const makeHalf = (isUpper) => {
      const half = new THREE.Group();
      const bladeGeo = new THREE.BoxGeometry(0.95, 0.09, 0.025);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.x = 0.38;
      half.add(blade);

      const ringGeo = new THREE.TorusGeometry(0.18, 0.045, 12, 24);
      const ring = new THREE.Mesh(ringGeo, handleMat);
      ring.position.set(-0.28, isUpper ? 0.14 : -0.14, 0);
      half.add(ring);
      return half;
    };

    this.scissorsBladeL = makeHalf(true);
    this.scissorsBladeR = makeHalf(false);
    this.scissorsGroup.add(this.scissorsBladeL);
    this.scissorsGroup.add(this.scissorsBladeR);
  }

  /**
   * 높이 y(0 ~ 3.85)에서의 페트병 반지름 계산
   */
  getBottleRadiusAtY(y) {
    const totalH = 3.85;
    const u = THREE.MathUtils.clamp(y / totalH, 0, 1);
    let r = 0.92;

    if (u < 0.06) {
      r = THREE.MathUtils.lerp(0.65, 0.92, u / 0.06);
    } else if (u < 0.72) {
      const rib = Math.sin(u * 65) * 0.015;
      const waist = (u > 0.32 && u < 0.58) ? -0.035 * Math.sin(((u - 0.32) / 0.26) * Math.PI) : 0;
      r = 0.92 + rib + waist;
    } else if (u < 0.90) {
      const t = (u - 0.72) / 0.18;
      r = THREE.MathUtils.lerp(0.90, 0.31, Math.pow(t, 0.85));
    } else {
      r = 0.31 + (u > 0.94 ? 0.025 : 0);
    }
    return r;
  }

  /**
   * 높이 y, 눌림 정도 pinchSqueeze에서의 페트병 내부 수평 단면적 A(y, s) 계산
   * 타원 반장축 a = r*(1 - p), 반단축 b = r*(1 + 0.42*p) -> A = pi * a * b
   */
  getBottleInnerAreaAtY(y, pinchSqueeze) {
    const innerR = Math.max(0.1, this.getBottleRadiusAtY(y) - 0.016);
    const p = this.getPinchAtY(y, pinchSqueeze);
    return Math.PI * innerR * innerR * (1 - p) * (1 + 0.42 * p);
  }

  /**
   * 바닥(y=0.04)부터 targetY까지의 페트병 내부 적분 부피 V(targetY, s) 계산
   */
  computeVolumeUpToY(targetY, pinchSqueeze) {
    const minY = 0.04;
    if (targetY <= minY) return 0;
    const steps = 48;
    const dy = (targetY - minY) / steps;
    let vol = 0;
    let prevA = this.getBottleInnerAreaAtY(minY, pinchSqueeze);
    for (let i = 1; i <= steps; i++) {
      const y = minY + i * dy;
      const currA = this.getBottleInnerAreaAtY(y, pinchSqueeze);
      vol += 0.5 * (prevA + currA) * dy;
      prevA = currA;
    }
    return vol;
  }

  /**
   * 비압축성 유체 연속 방정식(부피 보존)에 의해 주어진 물 부피 targetVol이 차오르는 정확한 수면 높이 y 계산
   */
  solveWaterHeightForVolume(targetVol, pinchSqueeze) {
    const minY = 0.04;
    const maxY = 3.85;
    const steps = 56;
    const dy = (maxY - minY) / steps;
    let cumVol = 0;
    let prevA = this.getBottleInnerAreaAtY(minY, pinchSqueeze);
    let resolvedY = maxY;
    let found = false;

    for (let i = 1; i <= steps; i++) {
      const y = minY + i * dy;
      const currA = this.getBottleInnerAreaAtY(y, pinchSqueeze);
      const dV = 0.5 * (prevA + currA) * dy;
      if (!found && cumVol + dV >= targetVol) {
        const frac = dV > 1e-6 ? (targetVol - cumVol) / dV : 0;
        resolvedY = (y - dy) + frac * dy;
        found = true;
      }
      cumVol += dV;
      prevA = currA;
    }

    const overflowVol = Math.max(0, targetVol - cumVol);
    return {
      waterY: found ? resolvedY : maxY,
      maxCapacity: cumVol,
      overflowVol
    };
  }

  /**
   * 500mL 투명 페트병 + 물 + 뚜껑 + 꾸미기 랩 + 물 넘침(실패) 시스템 생성
   */
  buildPETBottle() {
    this.bottleGroup = new THREE.Group();
    this.bottleGroup.position.set(1.25, 0, 0);
    this.scene.add(this.bottleGroup);

    // 500mL 페트병 외형 Lathe 프로필 생성
    const points = [];
    const heightSteps = 48;
    const totalH = 3.85;
    for (let i = 0; i <= heightSteps; i++) {
      const u = i / heightSteps;
      const y = u * totalH;
      const r = this.getBottleRadiusAtY(y);
      points.push(new THREE.Vector2(r, y));
    }

    this.bottleBodyGeo = new THREE.LatheGeometry(points, 48);
    // Vertex 변형(페트병 누르기)을 위해 원본 좌표 저장
    this.bottleOrigPositions = this.bottleBodyGeo.attributes.position.array.slice();

    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
      roughness: 0.07,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.bottleMesh = new THREE.Mesh(this.bottleBodyGeo, bottleMat);
    this.bottleGroup.add(this.bottleMesh);

    // 페트병 내부 곡면과 완벽히 밀착되어 차오르는 물 메쉬 (단위 원기둥을 생성 후 매 프레임 병 내벽에 맞춰 변형)
    this.bottleWaterGeo = new THREE.CylinderGeometry(1, 1, 1, 48, 32, false);
    this.bottleWaterUnitPos = this.bottleWaterGeo.attributes.position.array.slice();
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      transmission: 0.65,
      depthWrite: false
    });
    this.bottleWaterMesh = new THREE.Mesh(this.bottleWaterGeo, waterMat);
    this.bottleGroup.add(this.bottleWaterMesh);

    // 물 표면(수면 메니스커스 원판 - 수위 높이에 따라 병 어깨·목 폭에 맞춰 자동으로 줄어듦)
    const meniscusGeo = new THREE.CircleGeometry(1, 48);
    meniscusGeo.rotateX(-Math.PI / 2);
    const meniscusMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.waterSurfaceMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
    this.bottleGroup.add(this.waterSurfaceMesh);

    // 수면 가장자리 밝은 테두리 링 (수면 높이가 한눈에 자연스럽게 보이도록)
    const rimGeo = new THREE.RingGeometry(0.95, 1.0, 48);
    rimGeo.rotateX(-Math.PI / 2);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.waterRimMesh = new THREE.Mesh(rimGeo, rimMat);
    this.waterSurfaceMesh.add(this.waterRimMesh);

    // 페트병 겉면 유성펜 꾸미기 원통 메쉬 (CanvasTexture 연동)
    const decoGeo = new THREE.CylinderGeometry(1, 1, 2.25, 48, 20, true);
    this.bottleDecoOrigPos = decoGeo.attributes.position.array.slice();
    this.bottleDecoMat = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.bottleDecoMesh = new THREE.Mesh(decoGeo, this.bottleDecoMat);
    this.bottleDecoMesh.position.y = 1.48;
    this.bottleGroup.add(this.bottleDecoMesh);

    // 파란색 페트병 뚜껑
    const capGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 32);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      metalness: 0.1
    });
    this.bottleCapMesh = new THREE.Mesh(capGeo, capMat);
    // 처음에는 뚜껑이 열린 상태로 옆 위쪽에 떠 있음
    this.bottleCapMesh.position.set(0.85, 4.15, 0);
    this.bottleCapMesh.rotation.z = -0.35;
    this.bottleGroup.add(this.bottleCapMesh);

    // 페트병 양옆을 누르는 손/압력 패드 인디케이터
    const padGeo = new THREE.SphereGeometry(0.38, 24, 24);
    padGeo.scale(0.45, 1.35, 0.9);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0xfdba74,
      transparent: true,
      opacity: 0.0,
      roughness: 0.5
    });
    this.squeezeHandL = new THREE.Mesh(padGeo, padMat);
    this.squeezeHandR = new THREE.Mesh(padGeo, padMat.clone());
    this.squeezeHandL.position.set(-1.22, 1.65, 0);
    this.squeezeHandR.position.set(1.22, 1.65, 0);
    this.bottleGroup.add(this.squeezeHandL);
    this.bottleGroup.add(this.squeezeHandR);

    // 물속 미세 공기방울 파티클
    this.bubblesGroup = new THREE.Group();
    this.bottleGroup.add(this.bubblesGroup);
    const bubbleGeo = new THREE.SphereGeometry(0.032, 10, 10);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65
    });
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(bubbleGeo, bubbleMat);
      b.position.set(
        (Math.random() - 0.5) * 1.1,
        0.3 + Math.random() * 2.5,
        (Math.random() - 0.5) * 1.1
      );
      b.scale.setScalar(0.5 + Math.random() * 0.9);
      this.bubblesGroup.add(b);
      this.bubblesData.push({
        mesh: b,
        speed: 0.25 + Math.random() * 0.45,
        wobble: Math.random() * Math.PI * 2
      });
    }

    // 뚜껑을 닫지 않고 눌렀을 때 병 입구에서 쏟아지는 물줄기 & 책상 위 물웅덩이 생성
    this.spillGroup = new THREE.Group();
    this.bottleGroup.add(this.spillGroup);

    // 병 입구에서 넘쳐흐르는 물막 (Overflow Lip)
    const lipGeo = new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.85,
      roughness: 0.08
    });
    this.overflowLipMesh = new THREE.Mesh(lipGeo, lipMat);
    this.overflowLipMesh.position.set(0, 3.78, 0);
    this.overflowLipMesh.visible = false;
    this.spillGroup.add(this.overflowLipMesh);

    // 책상 바닥에 고이는 물웅덩이 (Puddle)
    const puddleGeo = new THREE.CircleGeometry(1.0, 48);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.72,
      roughness: 0.06,
      metalness: 0.15,
      clearcoat: 1.0
    });
    this.puddleMesh = new THREE.Mesh(puddleGeo, puddleMat);
    this.puddleMesh.position.set(0, 0.006, 0);
    this.puddleMesh.scale.setScalar(0.001);
    this.puddleMesh.visible = false;
    this.spillGroup.add(this.puddleMesh);

    const puddleRimGeo = new THREE.RingGeometry(0.92, 1.0, 48);
    puddleRimGeo.rotateX(-Math.PI / 2);
    const puddleRimMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    this.puddleRimMesh = new THREE.Mesh(puddleRimGeo, puddleRimMat);
    this.puddleMesh.add(this.puddleRimMesh);

    // 병 입구 밖으로 포물선(중력 가속도 g)을 그리며 쏟아지는 물방울 입자들
    const dropGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
      roughness: 0.05
    });
    this.spillDrops = [];
    for (let i = 0; i < 48; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      drop.visible = false;
      this.spillGroup.add(drop);
      this.spillDrops.push({
        mesh: drop,
        active: false,
        x: 0,
        y: 3.85,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        delay: (i / 48) * 0.45
      });
    }

    // 초기 물 부피(수위 y=3.04 기준 - 페트병 어깨 상단까지 물을 가득 채운 상태) 계산 및 저장
    this.initialWaterVolume = this.computeVolumeUpToY(3.04, 0);
  }

  /**
   * 쏟아진 물을 다시 채워 실험 상태를 정상으로 복구
   */
  refillWater() {
    this.state.spilledVolume = 0;
    this.state.isOverflowing = false;
    this.state.hasSpilledFailure = false;
    this.state.waterTopY = this.state.isInBottle ? 3.12 : 3.04;
    if (this.state.isInBottle && this.state.squidY < 2.5) {
      this.state.squidY = 2.95;
      this.state.squidVy = 0;
    }
    if (this.puddleMesh) {
      this.puddleMesh.visible = false;
      this.puddleMesh.scale.setScalar(0.001);
    }
    if (this.overflowLipMesh) {
      this.overflowLipMesh.visible = false;
    }
    this.spillDrops.forEach((d) => {
      d.active = false;
      d.mesh.visible = false;
    });
    if (this.onSpillStateChange) {
      this.onSpillStateChange(false, 0);
    }
  }

  /**
   * 3D 페트병을 마우스로 직접 꾹 누르면 압력이 가해지도록 Raycaster 설정
   */
  setupDirectBottleInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const checkHitBottle = (clientX, clientY) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);
      const hits = raycaster.intersectObject(this.bottleMesh, false);
      return hits.length > 0;
    };

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (this.state.isInBottle && checkHitBottle(e.clientX, e.clientY)) {
        this.isPointerDownOnBottle = true;
        this.controls.enabled = false;
        this.state.targetSqueeze = 0.92;
        if (this.onDirectSqueezeChange) this.onDirectSqueezeChange(92);
      }
    });

    window.addEventListener('pointerup', () => {
      if (this.isPointerDownOnBottle) {
        this.isPointerDownOnBottle = false;
        this.controls.enabled = true;
        this.state.targetSqueeze = 0;
        if (this.onDirectSqueezeChange) this.onDirectSqueezeChange(0);
      }
    });
  }

  /**
   * 2D 캔버스 2개(빨대 오징어 그림, 페트병 바다 그림)를 3D 텍스처로 연결
   */
  bindPaintCanvases(strawCanvas, bottleCanvas) {
    this.strawCanvasTexture = new THREE.CanvasTexture(strawCanvas);
    this.strawDecalMat.map = this.strawCanvasTexture;
    this.strawDecalMat.needsUpdate = true;

    this.bottleCanvasTexture = new THREE.CanvasTexture(bottleCanvas);
    this.bottleDecoMat.map = this.bottleCanvasTexture;
    this.bottleDecoMat.needsUpdate = true;
  }

  refreshPaintTextures() {
    if (this.strawCanvasTexture) this.strawCanvasTexture.needsUpdate = true;
    if (this.bottleCanvasTexture) this.bottleCanvasTexture.needsUpdate = true;
  }

  /**
   * 높이 y에서의 페트병 눌림(pinch) 비율 계산
   */
  getPinchAtY(y, squeezeAmount) {
    if (y > 0.35 && y < 2.85) {
      const yFactor = Math.sin(((y - 0.35) / 2.5) * Math.PI);
      return squeezeAmount * 0.44 * yFactor;
    }
    return 0;
  }

  /**
   * 페트병 몸통 및 내부 물 기둥·수면을 병 내벽 곡면에 맞춰 자연스럽게 변형
   */
  deformBottleGeometry(pinchSqueeze, waterTopY, handSqueeze = pinchSqueeze) {
    const posAttr = this.bottleBodyGeo.attributes.position;
    const orig = this.bottleOrigPositions;

    for (let i = 0; i < posAttr.count; i++) {
      const ix = i * 3;
      const ox = orig[ix];
      const oy = orig[ix + 1];
      const oz = orig[ix + 2];
      const pinch = this.getPinchAtY(oy, pinchSqueeze);

      posAttr.array[ix] = ox * (1 - pinch);
      posAttr.array[ix + 2] = oz * (1 + pinch * 0.42);
    }
    posAttr.needsUpdate = true;

    // 페트병 내부 물 기둥을 병 내벽 곡면(어깨 경사 + 눌린 허리)에 완벽히 밀착
    const waterAttr = this.bottleWaterGeo.attributes.position;
    const waterUnit = this.bottleWaterUnitPos;
    const minWaterY = 0.04;
    for (let i = 0; i < waterAttr.count; i++) {
      const ix = i * 3;
      const ux = waterUnit[ix];
      const uy = waterUnit[ix + 1]; // -0.5 ~ +0.5
      const uz = waterUnit[ix + 2];

      const t = uy + 0.5; // 0.0(바닥) ~ 1.0(수면)
      const wy = THREE.MathUtils.lerp(minWaterY, waterTopY, t);
      const innerR = Math.max(0.1, this.getBottleRadiusAtY(wy) - 0.016);
      const pinch = this.getPinchAtY(wy, pinchSqueeze);

      waterAttr.array[ix] = ux * innerR * (1 - pinch);
      waterAttr.array[ix + 1] = wy;
      waterAttr.array[ix + 2] = uz * innerR * (1 + pinch * 0.42);
    }
    waterAttr.needsUpdate = true;
    this.bottleWaterGeo.computeVertexNormals();

    // 수면 원판(waterSurfaceMesh)도 해당 수위(waterTopY)의 병 내부 단면 크기에 정확히 일치
    const topInnerR = Math.max(0.1, this.getBottleRadiusAtY(waterTopY) - 0.016);
    const topPinch = this.getPinchAtY(waterTopY, pinchSqueeze);
    this.waterSurfaceMesh.position.y = waterTopY;
    this.waterSurfaceMesh.scale.set(
      topInnerR * (1 - topPinch),
      1,
      topInnerR * (1 + topPinch * 0.42)
    );

    // 페트병 겉면 꾸미기 메쉬도 병 외벽 곡면에 밀착
    const decoAttr = this.bottleDecoMesh.geometry.attributes.position;
    const decoOrig = this.bottleDecoOrigPos;
    for (let i = 0; i < decoAttr.count; i++) {
      const ix = i * 3;
      const ux = decoOrig[ix];
      const oy = decoOrig[ix + 1] + 1.48;
      const uz = decoOrig[ix + 2];
      const outerR = this.getBottleRadiusAtY(oy) + 0.008;
      const pinch = this.getPinchAtY(oy, pinchSqueeze);

      decoAttr.array[ix] = ux * outerR * (1 - pinch);
      decoAttr.array[ix + 2] = uz * outerR * (1 + pinch * 0.42);
    }
    decoAttr.needsUpdate = true;

    // 손 압력 패드 위치 및 투명도 업데이트
    this.squeezeHandL.material.opacity = handSqueeze * 0.75;
    this.squeezeHandR.material.opacity = handSqueeze * 0.75;
    this.squeezeHandL.position.x = -1.05 + pinchSqueeze * 0.25;
    this.squeezeHandR.position.x = 1.05 - pinchSqueeze * 0.25;
  }

  /**
   * 뚜껑 미밀폐 시 물 넘침 파티클(자유낙하 포물선 운동) 및 책상 위 물웅덩이 업데이트
   */
  updateSpillEffects(dt) {
    const isOverflowing = this.state.isOverflowing;
    const spilledVol = this.state.spilledVolume;

    if (this.overflowLipMesh) {
      this.overflowLipMesh.visible = isOverflowing;
      if (isOverflowing) {
        const pulse = 1.0 + Math.sin(this.clock.getElapsedTime() * 28) * 0.08;
        this.overflowLipMesh.scale.set(pulse, 0.8 + this.state.squeeze * 0.5, pulse);
      }
    }

    // 책상 위 물웅덩이 크기 업데이트 (부피에 비례하여 반지름 증가)
    if (this.puddleMesh) {
      if (spilledVol > 0.005) {
        this.puddleMesh.visible = true;
        const targetRadius = Math.min(2.35, 0.55 + Math.sqrt(spilledVol) * 1.25);
        const currR = this.puddleMesh.scale.x;
        const nextR = THREE.MathUtils.lerp(currR, targetRadius, dt * 8);
        this.puddleMesh.scale.set(nextR, 1, nextR);
      } else {
        this.puddleMesh.visible = false;
      }
    }

    // 중력 가속도(g = 9.8)에 따른 물방울 포물선 낙하 운동
    const gravity = 9.8;
    this.spillDrops.forEach((d) => {
      if (isOverflowing) {
        if (d.delay > 0) {
          d.delay -= dt;
          return;
        }
        if (!d.active) {
          d.active = true;
          d.mesh.visible = true;
          const angle = Math.random() * Math.PI * 2;
          const rimR = 0.24 + Math.random() * 0.08;
          d.x = Math.cos(angle) * rimR;
          d.y = 3.85;
          d.z = Math.sin(angle) * rimR;
          const outSpeed = 0.65 + this.state.squeeze * 1.15 + Math.random() * 0.45;
          d.vx = Math.cos(angle) * outSpeed;
          d.vy = 0.55 + this.state.squeeze * 1.2 + Math.random() * 0.4;
          d.vz = Math.sin(angle) * outSpeed;
        }
      }

      if (d.active) {
        d.vy -= gravity * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.mesh.position.set(d.x, d.y, d.z);
        // 낙하 속도에 따라 물방울이 세로로 살짝 길어짐
        const stretch = THREE.MathUtils.clamp(1.0 + Math.abs(d.vy) * 0.18, 1.0, 2.2);
        d.mesh.scale.set(1.0 / Math.sqrt(stretch), stretch, 1.0 / Math.sqrt(stretch));

        // 책상 표면(y <= 0.02)에 닿으면 다시 병 입구에서 뿜어지거나 비활성화
        if (d.y <= 0.02) {
          if (isOverflowing) {
            const angle = Math.random() * Math.PI * 2;
            const rimR = 0.24 + Math.random() * 0.08;
            d.x = Math.cos(angle) * rimR;
            d.y = 3.85;
            d.z = Math.sin(angle) * rimR;
            const outSpeed = 0.65 + this.state.squeeze * 1.15 + Math.random() * 0.45;
            d.vx = Math.cos(angle) * outSpeed;
            d.vy = 0.55 + this.state.squeeze * 1.2 + Math.random() * 0.4;
            d.vz = Math.sin(angle) * outSpeed;
          } else {
            d.active = false;
            d.mesh.visible = false;
          }
        }
      }
    });
  }

  /**
   * 가위로 빨대 자르기 애니메이션 트리거
   */
  triggerScissorsCut() {
    this.state.isCut = true;
    this.scissorsTimer = 1.1;
    this.scissorsGroup.visible = true;
  }

  /**
   * 카메라 뷰 프리셋 이동
   */
  setCameraView(mode) {
    if (mode === 'front') {
      this.camera.position.set(0, 2.3, 8.2);
      this.controls.target.set(0, 1.5, 0);
    } else if (mode === 'closeup') {
      if (this.state.isInBottle) {
        this.camera.position.set(1.25, 2.1, 4.2);
        this.controls.target.set(1.25, 1.8, 0);
      } else {
        this.camera.position.set(-1.35, 1.8, 4.0);
        this.controls.target.set(-1.35, 1.4, 0.4);
      }
    } else if (mode === 'top') {
      this.camera.position.set(0, 6.8, 2.5);
      this.controls.target.set(0, 1.2, 0);
    }
    this.controls.update();
  }

  onResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * 매 프레임 애니메이션 및 연속방정식·파스칼의 원리·보일의 법칙·아르키메데스 부력 물리 업데이트
   */
  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    // 1. 주름 빨대 구부리기 보간
    const targetBend = this.state.isBent ? 1 : 0;
    if (Math.abs(this.state.bendAnim - targetBend) > 0.001) {
      this.state.bendAnim = THREE.MathUtils.lerp(this.state.bendAnim, targetBend, dt * 6);
      this.updateStrawBendGeometry(this.state.bendAnim);
    }

    // 2. 가위 자르기 연출 및 잘린 빨대 조각 낙하
    if (this.scissorsTimer > 0) {
      this.scissorsTimer -= dt;
      const snipAngle = Math.abs(Math.sin(this.scissorsTimer * 14)) * 0.35;
      this.scissorsBladeL.rotation.z = snipAngle;
      this.scissorsBladeR.rotation.z = -snipAngle;
      this.scissorsGroup.position.set(-1.58, 1.02, 0.72);
      if (this.scissorsTimer <= 0) {
        this.scissorsGroup.visible = false;
      }
    }

    if (this.state.isCut) {
      if (this.cutoffPieceMesh.position.y > -2.2) {
        this.cutoffPieceMesh.position.y -= dt * 2.8;
        this.cutoffPieceMesh.position.x -= dt * 0.6;
        this.cutoffPieceMesh.rotation.z += dt * 4.5;
      } else {
        this.cutoffPieceMesh.visible = false;
      }
    } else {
      this.cutoffPieceMesh.visible = true;
      this.cutoffPieceMesh.position.set(0, -1.41, 0);
      this.cutoffPieceMesh.rotation.set(0, 0, 0);
    }

    // 3. 셀로판테이프 표시
    this.tapeMesh.visible = this.state.isTaped;

    // 4. 클립 연결 및 빨대 구멍 끼우기 보간
    this.clipsAssemblyGroup.visible = this.state.isClipsHooked;
    const targetInsertY = this.state.isClipInserted ? -1.02 : -1.36;
    this.clipsAssemblyGroup.position.y = THREE.MathUtils.lerp(
      this.clipsAssemblyGroup.position.y,
      targetInsertY,
      dt * 7
    );

    // 5. 페트병 뚜껑 닫기 보간
    const targetCapX = this.state.isCapClosed ? 0 : 0.85;
    const targetCapY = this.state.isCapClosed ? 3.88 : 4.15;
    const targetCapRot = this.state.isCapClosed ? 0 : -0.35;
    this.bottleCapMesh.position.x = THREE.MathUtils.lerp(this.bottleCapMesh.position.x, targetCapX, dt * 8);
    this.bottleCapMesh.position.y = THREE.MathUtils.lerp(this.bottleCapMesh.position.y, targetCapY, dt * 8);
    this.bottleCapMesh.rotation.z = THREE.MathUtils.lerp(this.bottleCapMesh.rotation.z, targetCapRot, dt * 8);

    // 6. 페트병 누르기(Squeeze) 보간
    const prevSqueeze = this.state.squeeze;
    this.state.squeeze = THREE.MathUtils.lerp(this.state.squeeze, this.state.targetSqueeze, dt * 9);
    const squeezeRate = (this.state.squeeze - prevSqueeze) / Math.max(dt, 0.001);

    // 오징어 고체 물리량 (주름 빨대 + 테이프: 질량 0.45g, 부피 0.50 cm^3 / 클립 1개: 질량 0.48g, 부피 0.06 cm^3)
    const totalClips = this.state.hangingClipCount + 1; // 고정 클립 1개 + 매달린 다리 클립 N개
    const totalMassGrams = 0.45 + 0.48 * totalClips;
    const solidVolCm3 = 0.50 + 0.06 * totalClips;
    const V_cavity = 2.42; // 대기압(1.0 atm)에서 빨대 내부 전체 공기 공간 부피 (cm^3)
    const V_air0 = 2.42;

    // 현재 페트병에 남아 있는 물의 부피 (초기 물 부피 - 쏟아진 물 부피)
    const remainingWaterVol = Math.max(2.4, this.initialWaterVolume - this.state.spilledVolume);
    // 오징어가 물속에 잠겨 있을 때 밀어내는 3D 씬 단위 배수 부피
    const displacedSceneVol = this.state.isInBottle ? (this.state.submergedVolCm3 * 0.042) : 0;
    const totalLiquidAndSubmergedVol = remainingWaterVol + displacedSceneVol;

    let effectivePinch = this.state.squeeze;
    let waterTopY = 2.82;

    if (!this.state.isCapClosed) {
      // [케이스 A: 뚜껑이 열려 있을 때 (개방계)]
      // 1) 병 입구가 대기(1.0 atm)와 직접 통하므로 상단 기체 압력은 항상 대기압(1.0 atm)으로 유지됨
      this.state.headspacePressureAtm = 1.0;

      // 2) 비압축성인 물이 눌린 병 몸통에서 좁은 병목으로 급격히 밀려 올라감
      effectivePinch = this.state.squeeze;
      const volSolution = this.solveWaterHeightForVolume(totalLiquidAndSubmergedVol, effectivePinch);
      waterTopY = volSolution.waterY;

      // 3) 수위가 병 입구 끝(y = 3.85)에 도달한 상태에서 더 누르면 초과 부피만큼 병 밖으로 물이 쏟아짐!
      if (volSolution.overflowVol > 0.0005) {
        this.state.spilledVolume = Math.min(2.6, this.state.spilledVolume + volSolution.overflowVol);
        this.state.isOverflowing = true;
        waterTopY = 3.85;
        if (this.state.spilledVolume > 0.04 && !this.state.hasSpilledFailure) {
          this.state.hasSpilledFailure = true;
          if (this.onSpillStateChange) {
            this.onSpillStateChange(true, this.state.spilledVolume);
          }
        }
      } else {
        this.state.isOverflowing = (this.state.squeeze > 0.25 && waterTopY >= 3.83 && squeezeRate > -0.05);
      }
    } else {
      // [케이스 B: 뚜껑이 닫혀 있을 때 (밀폐계)]
      // 1) 물이 병 밖으로 빠져나갈 수 없으므로 넘침 없음
      this.state.isOverflowing = false;

      // 2) 비압축성 액체(물)는 부피가 줄어들지 않으므로, 상단 공기층(Headspace)과 빨대 속 공기만 압축됨
      const unpinchedBottleCap = this.computeVolumeUpToY(3.85, 0);
      const V_head0 = Math.max(0.18, unpinchedBottleCap - totalLiquidAndSubmergedVol);
      // 손으로 누르는 힘에 의해 상단 공기가 압축되는 부피 변화량
      const deltaV_gas = Math.min(V_head0 * 0.468 * this.state.squeeze, 0.142 * this.state.squeeze);
      const V_head = Math.max(0.08, V_head0 - deltaV_gas);

      // 3) 보일의 법칙(P_head * V_head = P0 * V_head0):
      // 정상 수위에서는 최대로 누를 때 P_head ≈ 1.88 atm까지 상승!
      // 만약 뚜껑을 안 닫고 눌러 물을 쏟은 뒤(V_head0가 매우 커진 상태) 물을 안 채우고 뚜껑만 닫으면,
      // 공기 완충 공간(V_head0)이 너무 커서 P_head가 거의 올라가지 않아(≈ 1.15 atm) 오징어가 가라앉지 않음!
      this.state.headspacePressureAtm = 1.0 * (V_head0 / V_head);

      // 밀폐된 상태에서 병 벽면의 실제 오목 변형량은 기체가 압축된 부피(deltaV_gas)에 비례
      effectivePinch = this.state.squeeze * 0.45;
      const sealedSolution = this.solveWaterHeightForVolume(totalLiquidAndSubmergedVol, effectivePinch);
      waterTopY = Math.min(3.78, sealedSolution.waterY);
    }

    this.state.waterTopY = waterTopY;
    this.deformBottleGeometry(effectivePinch, waterTopY, this.state.squeeze);
    this.updateSpillEffects(dt);

    if (this.state.isInBottle) {
      // 1) 수심(h)에 따른 정수압 (Hydrostatic pressure: P_hydro = rho * g * h)
      // 빨대 내부 공기-물 경계면(메니스커스)의 월드 Y 좌표
      const legLen = 1.05;
      const meniscusWorldY = this.state.squidY - legLen + legLen * this.state.waterInStrawRatio;
      const submergenceDepth = Math.max(0, waterTopY - meniscusWorldY);
      const depthPressureAtm = submergenceDepth * 0.022;

      // 2) 파스칼의 원리: 빨대 하단 열린 구멍을 통해 전달되는 총 절대 압력 P_straw (단위: atm)
      const totalPressureAtm = this.state.headspacePressureAtm + depthPressureAtm;
      this.state.totalPressureAtm = totalPressureAtm;

      // 3) 보일의 법칙 (P_straw * V_air = P0 * V_air0):
      // 압력에 정확히 반비례하여 빨대 내부 공기 부피가 줄어들고, 줄어든 공간만큼 아래에서 물이 차오름
      const V_air = V_air0 / totalPressureAtm;
      this.state.airVolumeRatio = THREE.MathUtils.clamp(V_air / V_cavity, 0.35, 1.0);
      this.state.waterInStrawRatio = THREE.MathUtils.clamp(1.0 - this.state.airVolumeRatio, 0.0, 0.65);

      // 4) 아르키메데스의 부력 법칙 (F_b = rho_water * V_submerged * g) vs 중력 (W = m_total * g)
      const maxDisplacedVolCm3 = solidVolCm3 + V_air;

      // 수면(waterTopY) 위로 빨대 정수리(y = squidY + 0.25)가 올라오면 노출된 부피만큼 배수 부피 감소
      const strawCrownY = this.state.squidY + 0.25;
      const emergedHeight = Math.max(0, strawCrownY - waterTopY);
      const emergedFraction = THREE.MathUtils.clamp(emergedHeight / 0.55, 0, 0.92);
      const submergedVolCm3 = maxDisplacedVolCm3 * (1.0 - emergedFraction);

      this.state.totalMassGrams = totalMassGrams;
      this.state.submergedVolCm3 = submergedVolCm3;
      this.state.netBuoyancyGf = submergedVolCm3 - totalMassGrams;

      // 알짜 힘 (부력 - 중력) 및 유체 항력(선형 점성 저항 + 이차 형상 저항)
      const netBuoyancyForce = (submergedVolCm3 - totalMassGrams) * 7.2;
      const linearDrag = -this.state.squidVy * 3.8;
      const quadDrag = -this.state.squidVy * Math.abs(this.state.squidVy) * 1.6;

      // 뉴턴의 제2법칙 (F = m_eff * a, 부가 질량 포함)
      const accelY = (netBuoyancyForce + linearDrag + quadDrag) / (totalMassGrams * 0.45);
      this.state.squidVy += accelY * dt;
      this.state.squidY += this.state.squidVy * dt;

      // 5) 강체 경계 조건 (바닥 수직항력 및 병목 반경 제약):
      // - 바닥 한계(bottomLimitY = 1.45): 고정 클립 하단(y = squidY - 1.37)이 병 바닥 내벽(y = 0.08)에 닿음
      // - 상단 병목 한계(neckLimitY = 3.32): U자 빨대 폭(0.65)이 좁아지는 병목(반지름 0.31)을 통과하지 못함
      const bottomLimitY = 1.45;
      if (this.state.squidY <= bottomLimitY) {
        this.state.squidY = bottomLimitY;
        if (this.state.squidVy < 0) this.state.squidVy = 0;
      }
      const topLimitY = Math.min(3.32, waterTopY + 0.12);
      if (this.state.squidY > topLimitY) {
        this.state.squidY = topLimitY;
        if (this.state.squidVy > 0) this.state.squidVy = 0;
      }

      // 바닥에 완전히 가라앉아 있을 때는 수면 물결 진동을 멈추고 바닥에 안착
      const isRestingOnBottom = (this.state.squidY <= bottomLimitY + 0.015) && (netBuoyancyForce <= 0);
      const waveBobbing = isRestingOnBottom ? 0 : Math.sin(elapsed * 2.4) * 0.012;

      // 오징어를 페트병 중심(x=1.25, z=0)에 배치 (바닥 안착 시 자연스럽게 살짝 기울어짐)
      this.squidGroup.position.x = THREE.MathUtils.lerp(this.squidGroup.position.x, 1.25, dt * 7);
      this.squidGroup.position.z = THREE.MathUtils.lerp(this.squidGroup.position.z, 0, dt * 7);
      this.squidGroup.position.y = this.state.squidY + waveBobbing;
      this.squidGroup.rotation.y = Math.sin(elapsed * 1.1) * (isRestingOnBottom ? 0.03 : 0.15);
      this.squidGroup.rotation.z = THREE.MathUtils.lerp(
        this.squidGroup.rotation.z,
        isRestingOnBottom ? 0.12 : 0,
        dt * 5
      );

      // 6) 빨대 내부에 압력에 따라 들어오는 물 기둥과 압축되는 공기 기둥 3D 시각화
      this.internalWaterLeft.visible = true;
      this.internalWaterRight.visible = true;
      this.internalAirLeft.visible = true;
      this.internalAirRight.visible = true;
      this.internalAirArch.visible = true;
      this.strawMeniscusL.visible = true;
      this.strawMeniscusR.visible = true;

      // 아치 부분 부피를 고려하여 두 다리에서 물이 차오르는 높이(waterH) 계산
      const legWaterFraction = THREE.MathUtils.clamp(this.state.waterInStrawRatio * 1.32, 0.04, 0.88);
      const waterH = legLen * legWaterFraction;
      const airH = Math.max(0.05, legLen - waterH);
      const meniscusLocalY = -legLen + waterH;

      this.internalWaterLeft.scale.y = Math.max(0.04, waterH);
      this.internalWaterLeft.position.set(-0.23, -legLen + waterH / 2, 0);
      this.internalWaterRight.scale.y = Math.max(0.04, waterH);
      this.internalWaterRight.position.set(0.23, -legLen + waterH / 2, 0);

      this.internalAirLeft.scale.y = airH;
      this.internalAirLeft.position.set(-0.23, -airH / 2, 0);
      this.internalAirRight.scale.y = airH;
      this.internalAirRight.position.set(0.23, -airH / 2, 0);

      // 공기-물 경계면 밝은 메니스커스 링 위치 업데이트
      this.strawMeniscusL.position.set(-0.23, meniscusLocalY, 0);
      this.strawMeniscusR.position.set(0.23, meniscusLocalY, 0);

      // 압력 변화 시 빨대 하단 구멍으로 물/기포가 밀려 들어오고 나가는 입자 애니메이션
      const showFlow = this.state.isCapClosed && (this.state.squeeze > 0.05 || Math.abs(squeezeRate) > 0.05);
      this.strawFlowDrops.forEach((fd) => {
        fd.mesh.visible = showFlow;
        if (showFlow) {
          fd.phase = (fd.phase + dt * (0.8 + Math.abs(squeezeRate) * 2.5) * (squeezeRate >= -0.02 ? 1 : -1) + 1) % 1;
          const yPos = THREE.MathUtils.lerp(-legLen - 0.04, meniscusLocalY, fd.phase);
          fd.mesh.position.set(fd.legSign * 0.23, yPos, 0);
        }
      });
    } else {
      // 실험대 위 제작 위치 (클립이 책상 위로 완전히 보이도록 y=2.25 유지)
      this.squidGroup.position.x = THREE.MathUtils.lerp(this.squidGroup.position.x, -1.35, dt * 6);
      this.squidGroup.position.y = THREE.MathUtils.lerp(this.squidGroup.position.y, 2.25, dt * 6);
      this.squidGroup.position.z = THREE.MathUtils.lerp(this.squidGroup.position.z, 0.6, dt * 6);
      this.squidGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.12;
      this.squidGroup.rotation.z = THREE.MathUtils.lerp(this.squidGroup.rotation.z, 0, dt * 6);

      this.internalWaterLeft.visible = false;
      this.internalWaterRight.visible = false;
      this.internalAirLeft.visible = false;
      this.internalAirRight.visible = false;
      this.internalAirArch.visible = false;
      this.strawMeniscusL.visible = false;
      this.strawMeniscusR.visible = false;
      this.strawFlowDrops.forEach((fd) => {
        fd.mesh.visible = false;
      });
      this.state.waterInStrawRatio = 0;
      this.state.airVolumeRatio = 1.0;
      this.state.totalPressureAtm = 1.0;
    }

    // 오징어 다리 클립들의 물리적 바닥 접촉(바닥에 닿으면 뚫고 내려가지 않고 옆/앞뒤로 꺾여 누움) 및 유체 저항
    const count = this.hangingClipsGroup.children.length;
    const clipLen = 0.66;
    const bottleFloorY = 0.08;
    // 다리 클립이 걸려 있는 힌지(연결부)의 월드 Y 좌표
    const hingeWorldY = this.squidGroup.position.y - 1.32;
    let floorFoldAngle = 0;
    if (this.state.isInBottle && hingeWorldY - clipLen < bottleFloorY) {
      // 바닥 수직항력에 의해 클립 하단 끝이 항상 y >= bottleFloorY 위에 놓이도록 꺾임 각도(arccos) 계산
      const clearanceY = THREE.MathUtils.clamp(hingeWorldY - bottleFloorY, 0.06, clipLen);
      floorFoldAngle = Math.acos(clearanceY / clipLen);
    }

    this.hangingClipsGroup.children.forEach((clip, idx) => {
      const centerOffset = idx - (count - 1) / 2;
      const baseSpread = centerOffset * 0.08;
      // 내려갈 때(squidVy < 0)는 물의 저항으로 다리가 살짝 바깥으로 벌어지고, 올라갈 때는 안으로 모아짐
      const dragFlare = this.state.isInBottle
        ? THREE.MathUtils.clamp(-this.state.squidVy * 0.06, -0.08, 0.12) * Math.sign(centerOffset || 1)
        : 0;

      // 바닥에 닿을 때는 클립들이 병 바닥 안쪽에서 부채꼴로 자연스럽게 눕도록 X/Z 회전 배분
      const sideSign = idx % 2 === 0 ? 1 : -1;
      const targetRotX = floorFoldAngle > 0.01
        ? sideSign * floorFoldAngle * 0.82
        : Math.sin(elapsed * (this.state.isInBottle ? 3.2 : 1.5) + idx) * (this.state.isInBottle ? 0.02 + Math.min(0.1, Math.abs(this.state.squidVy) * 0.06) : 0.015);

      const targetRotZ = baseSpread + dragFlare + (centerOffset * floorFoldAngle * 0.28);

      clip.rotation.x = THREE.MathUtils.lerp(clip.rotation.x, targetRotX, dt * 10);
      clip.rotation.z = THREE.MathUtils.lerp(clip.rotation.z, targetRotZ, dt * 10);
    });

    // 물속 공기방울 상승 애니메이션 (수면 아래에서만 상승하도록 제한)
    this.bubblesData.forEach((b) => {
      b.mesh.position.y += b.speed * (1 + this.state.squeeze * 2.5) * dt;
      b.mesh.position.x += Math.sin(elapsed * 3 + b.wobble) * 0.002;
      if (b.mesh.position.y > waterTopY - 0.06) {
        b.mesh.position.y = 0.22;
      }
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.SquidExperiment3D = SquidExperiment3D;
