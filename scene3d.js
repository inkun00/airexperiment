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
      // 물리 시뮬레이션 변수
      squidY: 1.55,      // 물속 오징어 높이 (물 표면 근처 ~ 바닥)
      squidVy: 0,
      waterInStrawRatio: 0.15, // 빨대 내부에 물이 찬 비율 (0.1 ~ 0.78)
      airVolumeRatio: 1.0      // 빨대 내부 공기 부피 비율 (100% 기준)
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
    this.internalAirGlow = null;

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

    // 캔버스 텍스처 참조
    this.strawCanvasTexture = null;
    this.bottleCanvasTexture = null;

    this.isPointerDownOnBottle = false;
    this.onDirectSqueezeChange = null;

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

    // 반투명 주름 빨대 재질 (어두운 배경/책상 위에서 선명하게 보이도록 대비 강화)
    const strawMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x1e293b,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.68,
      roughness: 0.15,
      transmission: 0.38,
      side: THREE.DoubleSide
    });

    const strawRadius = 0.095;
    const archRadius = 0.23; // U자 굽힘 반경

    // 1) 오른쪽 짧은 쪽 다리 (x = +archRadius, 길이 1.05)
    const shortLegGeo = new THREE.CylinderGeometry(strawRadius, strawRadius, 1.05, 24, 1, true);
    this.shortLegMesh = new THREE.Mesh(shortLegGeo, strawMat);
    this.shortLegMesh.position.set(archRadius, -0.525, 0);
    this.strawGroup.add(this.shortLegMesh);

    // 2) 주름 마디 (위쪽 U자 아치 부분 - 주름 링 11개로 사실적 표현)
    this.bellowsGroup = new THREE.Group();
    this.strawGroup.add(this.bellowsGroup);

    const numRings = 12;
    this.bellowRings = [];
    for (let i = 0; i <= numRings; i++) {
      const ringGeo = new THREE.TorusGeometry(strawRadius * 1.04, 0.022, 10, 24);
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

    const extrudeSettings = { depth: 0.32, bevelEnabled: false, curveSegments: 24 };
    const tapeGeo = new THREE.ExtrudeGeometry(tapeShape, extrudeSettings);
    tapeGeo.rotateX(Math.PI / 2);
    const tapeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      side: THREE.DoubleSide
    });
    this.tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
    this.tapeMesh.position.set(0, -0.28, 0);
    this.tapeMesh.visible = false;
    this.strawGroup.add(this.tapeMesh);

    // 6) 유성펜 드로잉이 매핑될 오징어 몸통 곡면 데칼 메쉬
    const decalGeo = new THREE.PlaneGeometry(0.68, 1.15);
    this.strawDecalMat = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.strawDecalMesh = new THREE.Mesh(decalGeo, this.strawDecalMat);
    this.strawDecalMesh.position.set(0, -0.42, strawRadius + 0.018);
    this.strawGroup.add(this.strawDecalMesh);

    // 7) 빨대 내부의 공기 기둥(노란빛 하이라이트) & 차오르는 물 기둥(파란색)
    const innerWaterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.82,
      roughness: 0.1
    });
    const innerAirMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.52
    });

    const innerCylGeo = new THREE.CylinderGeometry(strawRadius * 0.78, strawRadius * 0.78, 1.0, 16);
    this.internalWaterLeft = new THREE.Mesh(innerCylGeo, innerWaterMat);
    this.internalWaterRight = new THREE.Mesh(innerCylGeo, innerWaterMat);
    this.internalAirLeft = new THREE.Mesh(innerCylGeo, innerAirMat);
    this.internalAirRight = new THREE.Mesh(innerCylGeo, innerAirMat);

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
   * 500mL 투명 페트병 + 물 + 뚜껑 + 꾸미기 랩 + 공기방울 입자 생성
   */
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
   * 500mL 투명 페트병 + 물 + 뚜껑 + 꾸미기 랩 + 공기방울 입자 생성
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
      opacity: 0.30,
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
      opacity: 0.24,
      roughness: 0.08,
      transmission: 0.6,
      depthWrite: false
    });
    this.bottleWaterMesh = new THREE.Mesh(this.bottleWaterGeo, waterMat);
    this.bottleGroup.add(this.bottleWaterMesh);

    // 물 표면(수면 메니스커스 원판 - 수위 높이에 따라 병 어깨 폭에 맞춰 자동으로 줄어듦)
    const meniscusGeo = new THREE.CircleGeometry(1, 48);
    meniscusGeo.rotateX(-Math.PI / 2);
    const meniscusMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.46,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.waterSurfaceMesh = new THREE.Mesh(meniscusGeo, meniscusMat);
    this.bottleGroup.add(this.waterSurfaceMesh);

    // 수면 가장자리 밝은 테두리 링 (수면 높이가 한눈에 자연스럽게 보이도록)
    const rimGeo = new THREE.RingGeometry(0.96, 1.0, 48);
    rimGeo.rotateX(-Math.PI / 2);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.85,
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
    if (y > 0.45 && y < 2.75) {
      const yFactor = Math.sin(((y - 0.45) / 2.3) * Math.PI);
      return squeezeAmount * 0.34 * yFactor;
    }
    return 0;
  }

  /**
   * 페트병 몸통 및 내부 물 기둥·수면을 병 내벽 곡면에 맞춰 자연스럽게 변형
   */
  deformBottleGeometry(squeezeAmount, waterTopY) {
    const posAttr = this.bottleBodyGeo.attributes.position;
    const orig = this.bottleOrigPositions;

    for (let i = 0; i < posAttr.count; i++) {
      const ix = i * 3;
      const ox = orig[ix];
      const oy = orig[ix + 1];
      const oz = orig[ix + 2];
      const pinch = this.getPinchAtY(oy, squeezeAmount);

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
      const pinch = this.getPinchAtY(wy, squeezeAmount);

      waterAttr.array[ix] = ux * innerR * (1 - pinch);
      waterAttr.array[ix + 1] = wy;
      waterAttr.array[ix + 2] = uz * innerR * (1 + pinch * 0.42);
    }
    waterAttr.needsUpdate = true;
    this.bottleWaterGeo.computeVertexNormals();

    // 수면 원판(waterSurfaceMesh)도 해당 수위(waterTopY)의 병 내부 단면 크기에 정확히 일치
    const topInnerR = Math.max(0.1, this.getBottleRadiusAtY(waterTopY) - 0.016);
    const topPinch = this.getPinchAtY(waterTopY, squeezeAmount);
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
      const pinch = this.getPinchAtY(oy, squeezeAmount);

      decoAttr.array[ix] = ux * outerR * (1 - pinch);
      decoAttr.array[ix + 2] = uz * outerR * (1 + pinch * 0.42);
    }
    decoAttr.needsUpdate = true;

    // 손 압력 패드 위치 및 투명도 업데이트
    this.squeezeHandL.material.opacity = squeezeAmount * 0.72;
    this.squeezeHandR.material.opacity = squeezeAmount * 0.72;
    this.squeezeHandL.position.x = -1.05 + squeezeAmount * 0.25;
    this.squeezeHandR.position.x = 1.05 - squeezeAmount * 0.25;
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
   * 매 프레임 애니메이션 및 아르키메데스 부력·보일의 법칙 물리 업데이트
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

    // 6. 페트병 누르기 압력 및 병 내부 수위 계산
    this.state.squeeze = THREE.MathUtils.lerp(this.state.squeeze, this.state.targetSqueeze, dt * 9);
    const baseWaterLevel = this.state.isInBottle ? 2.86 : 2.80;
    const waterTopY = baseWaterLevel + this.state.squeeze * 0.28;
    this.deformBottleGeometry(this.state.squeeze, waterTopY);

    if (this.state.isInBottle) {
      // 뚜껑이 닫혀 있어야 압력이 공기 방울에 온전히 전달됨! (뚜껑이 열려 있으면 압력 전달이 15%에 불과)
      const effectivePressure = this.state.isCapClosed
        ? this.state.squeeze
        : this.state.squeeze * 0.12;

      // 보일의 법칙에 따른 빨대 내부 공기 부피 감소 및 물 유입 비율
      const baseWaterByWeight = (this.state.hangingClipCount - 1) * 0.035;
      this.state.waterInStrawRatio = THREE.MathUtils.clamp(
        0.12 + baseWaterByWeight + effectivePressure * 0.48,
        0.10,
        0.75
      );
      this.state.airVolumeRatio = 1.0 - (this.state.waterInStrawRatio - 0.12) * 0.85;

      // 클립 개수(1~6개)별 초기 부력 평형 높이(restY)와 최대 압력 시 도달 높이(pressedY)
      // 수면(waterTopY)을 기준으로 빨대 윗부분(arch 반경 0.23)이 자연스럽게 위치하도록 설정
      const clipProfiles = {
        1: { restY: waterTopY - 0.02, pressedY: waterTopY - 0.35 }, // 1개: 물 위로 많이 솟아 있고, 눌러도 조금만 내려감
        2: { restY: waterTopY - 0.10, pressedY: 1.88 },             // 2개: 물 위로 꽤 나와 있고, 끝까지 눌러도 중간까지만 내려감
        3: { restY: waterTopY - 0.18, pressedY: 1.02 },             // 3개: 물 위로 살짝 나오고, 누르면 바닥까지 쑥 내려갔다 올라옴
        4: { restY: waterTopY - 0.36, pressedY: 1.02 },             // 4개: 수면 바로 아래에 떠 있고, 조금만 눌러도 바닥으로 급강하
        5: { restY: 1.38, pressedY: 1.02 },                         // 5개: 누르지 않아도 거의 바닥 근처까지 가라앉음
        6: { restY: 1.02, pressedY: 1.02 }                          // 6개: 넣자마자 바닥에 완전히 가라앉아 움직이지 않음
      };
      const profile = clipProfiles[this.state.hangingClipCount] || clipProfiles[3];
      const pressCurve = Math.min(1, effectivePressure * (this.state.hangingClipCount === 4 ? 1.45 : 1.1));
      const targetY = THREE.MathUtils.lerp(profile.restY, profile.pressedY, pressCurve);

      // 물속 저항과 탄성을 포함한 자연스러운 가속도 이동
      const forceY = (targetY - this.state.squidY) * 9.5;
      this.state.squidVy = (this.state.squidVy + forceY * dt) * Math.pow(0.18, dt);
      this.state.squidY += this.state.squidVy * dt;

      // 오징어를 페트병 중심(x=1.25, z=0)에 배치 + 물결 흔들림
      this.squidGroup.position.x = THREE.MathUtils.lerp(this.squidGroup.position.x, 1.25, dt * 7);
      this.squidGroup.position.z = THREE.MathUtils.lerp(this.squidGroup.position.z, 0, dt * 7);
      this.squidGroup.position.y = this.state.squidY + Math.sin(elapsed * 2.6) * 0.025;
      this.squidGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.18;

      // 빨대 내부에 차오르는 물 기둥과 줄어드는 공기 기둥 시각화
      this.internalWaterLeft.visible = true;
      this.internalWaterRight.visible = true;
      this.internalAirLeft.visible = true;
      this.internalAirRight.visible = true;

      const legLen = 1.05;
      const waterH = legLen * this.state.waterInStrawRatio;
      const airH = legLen - waterH;

      this.internalWaterLeft.scale.y = Math.max(0.05, waterH);
      this.internalWaterLeft.position.set(-0.23, -legLen + waterH / 2, 0);
      this.internalWaterRight.scale.y = Math.max(0.05, waterH);
      this.internalWaterRight.position.set(0.23, -legLen + waterH / 2, 0);

      this.internalAirLeft.scale.y = Math.max(0.05, airH);
      this.internalAirLeft.position.set(-0.23, -airH / 2, 0);
      this.internalAirRight.scale.y = Math.max(0.05, airH);
      this.internalAirRight.position.set(0.23, -airH / 2, 0);
    } else {
      // 실험대 위 제작 위치 (클립이 책상 위로 완전히 보이도록 y=2.25 유지)
      this.squidGroup.position.x = THREE.MathUtils.lerp(this.squidGroup.position.x, -1.35, dt * 6);
      this.squidGroup.position.y = THREE.MathUtils.lerp(this.squidGroup.position.y, 2.25, dt * 6);
      this.squidGroup.position.z = THREE.MathUtils.lerp(this.squidGroup.position.z, 0.6, dt * 6);
      this.squidGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.12;

      this.internalWaterLeft.visible = false;
      this.internalWaterRight.visible = false;
      this.internalAirLeft.visible = false;
      this.internalAirRight.visible = false;
      this.state.waterInStrawRatio = 0;
      this.state.airVolumeRatio = 1.0;
    }

    // 오징어 다리 클립들의 살랑거리는 움직임
    this.hangingClipsGroup.children.forEach((clip, idx) => {
      const speed = this.state.isInBottle ? 3.5 : 1.5;
      const amp = this.state.isInBottle ? 0.06 + Math.abs(this.state.squidVy) * 0.08 : 0.02;
      clip.rotation.x = Math.sin(elapsed * speed + idx) * amp;
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
