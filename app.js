/**
 * app.js
 * 오르락내리락 오징어 장난감 3D 실험 컨트롤러
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Web Audio API 효과음 합성기
  // ==========================================
  class SoundFX {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    initCtx() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playClick() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.065);
    }

    playBendStraw() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280 + i * 55, now + i * 0.045);
        gain.gain.setValueAtTime(0.14, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.042);
      }
    }

    playSnip() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.09;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.35;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    playClipClink() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [1250, 1680].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.15, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.15);
      });
    }

    playSplash() {
      if (!this.enabled) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    }
  }

  const sfx = new SoundFX();
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  btnSoundToggle.addEventListener('click', () => {
    sfx.enabled = !sfx.enabled;
    btnSoundToggle.textContent = sfx.enabled ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
  });

  // ==========================================
  // 2. 3D 시뮬레이션 초기화
  // ==========================================
  const sim3D = new window.SquidExperiment3D('threeCanvasContainer');

  // ==========================================
  // 3. 유성펜 드로잉 캔버스 (빨대 오징어 & 페트병 꾸미기)
  // ==========================================
  const strawCanvas = document.getElementById('strawPaintCanvas');
  const bottleCanvas = document.getElementById('bottlePaintCanvas');
  const strawCtx = strawCanvas.getContext('2d');
  const bottleCtx = bottleCanvas.getContext('2d');

  let currentMarkerColor = '#111827';

  function drawDefaultSquidArt() {
    strawCtx.clearRect(0, 0, strawCanvas.width, strawCanvas.height);

    strawCtx.fillStyle = '#dc2626';
    const spots = [
      [95, 38], [130, 32], [165, 40],
      [82, 62], [118, 56], [152, 60], [178, 66],
      [92, 85], [142, 82], [168, 90]
    ];
    spots.forEach(([x, y]) => {
      strawCtx.beginPath();
      strawCtx.arc(x, y, 5.5, 0, Math.PI * 2);
      strawCtx.fill();
    });

    const drawEye = (cx, cy) => {
      strawCtx.fillStyle = '#ffffff';
      strawCtx.strokeStyle = '#111827';
      strawCtx.lineWidth = 4;
      strawCtx.beginPath();
      strawCtx.arc(cx, cy, 16, 0, Math.PI * 2);
      strawCtx.fill();
      strawCtx.stroke();

      strawCtx.fillStyle = '#111827';
      strawCtx.beginPath();
      strawCtx.arc(cx + 2, cy, 8, 0, Math.PI * 2);
      strawCtx.fill();

      strawCtx.fillStyle = '#ffffff';
      strawCtx.beginPath();
      strawCtx.arc(cx - 2, cy - 3, 3, 0, Math.PI * 2);
      strawCtx.fill();
    };
    drawEye(102, 128);
    drawEye(158, 128);

    strawCtx.strokeStyle = '#111827';
    strawCtx.lineWidth = 4;
    strawCtx.lineCap = 'round';
    strawCtx.beginPath();
    strawCtx.arc(130, 150, 12, 0.15 * Math.PI, 0.85 * Math.PI);
    strawCtx.stroke();

    sim3D.refreshPaintTextures();
  }

  function drawDefaultBottleArt() {
    bottleCtx.clearRect(0, 0, bottleCanvas.width, bottleCanvas.height);

    bottleCtx.strokeStyle = '#2563eb';
    bottleCtx.lineWidth = 4;
    bottleCtx.lineCap = 'round';

    [45, 95, 145].forEach((rowY) => {
      bottleCtx.beginPath();
      for (let x = 10; x <= 250; x += 30) {
        bottleCtx.moveTo(x, rowY);
        bottleCtx.quadraticCurveTo(x + 15, rowY + 14, x + 30, rowY);
      }
      bottleCtx.stroke();
    });

    bottleCtx.strokeStyle = '#16a34a';
    bottleCtx.lineWidth = 5;
    [45, 215].forEach((bx) => {
      bottleCtx.beginPath();
      bottleCtx.moveTo(bx, 210);
      bottleCtx.bezierCurveTo(bx - 14, 180, bx + 14, 155, bx - 5, 125);
      bottleCtx.stroke();
    });

    bottleCtx.fillStyle = '#ef4444';
    bottleCtx.beginPath();
    bottleCtx.arc(135, 182, 9, 0, Math.PI * 2);
    bottleCtx.fill();

    sim3D.refreshPaintTextures();
  }

  sim3D.bindPaintCanvases(strawCanvas, bottleCanvas);
  drawDefaultSquidArt();
  drawDefaultBottleArt();

  function attachCanvasDrawing(canvas, ctx) {
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const start = (e) => {
      drawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    };

    const move = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.strokeStyle = currentMarkerColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      sim3D.refreshPaintTextures();
    };

    const stop = () => {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
  }

  attachCanvasDrawing(strawCanvas, strawCtx);
  attachCanvasDrawing(bottleCanvas, bottleCtx);

  let activePaintTarget = 'straw';
  document.querySelectorAll('.paint-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      sfx.playClick();
      activePaintTarget = tab.dataset.target;
      document.querySelectorAll('.paint-tab').forEach((t) => t.classList.toggle('active', t === tab));
      strawCanvas.classList.toggle('active', activePaintTarget === 'straw');
      bottleCanvas.classList.toggle('active', activePaintTarget === 'bottle');
    });
  });

  document.querySelectorAll('.color-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      sfx.playClick();
      currentMarkerColor = sw.dataset.color;
      document.querySelectorAll('.color-swatch').forEach((s) => s.classList.toggle('active', s === sw));
    });
  });

  document.getElementById('btnPresetCuteSquid').addEventListener('click', () => {
    sfx.playClick();
    drawDefaultSquidArt();
  });

  document.getElementById('btnPresetOceanWaves').addEventListener('click', () => {
    sfx.playClick();
    drawDefaultBottleArt();
  });

  document.getElementById('btnClearCanvas').addEventListener('click', () => {
    sfx.playClick();
    if (activePaintTarget === 'straw') {
      strawCtx.clearRect(0, 0, strawCanvas.width, strawCanvas.height);
    } else {
      bottleCtx.clearRect(0, 0, bottleCanvas.width, bottleCanvas.height);
    }
    sim3D.refreshPaintTextures();
  });

  // ==========================================
  // 4. 3D 실험실 4단계 워크플로우 제어
  // ==========================================
  const stepPills = document.querySelectorAll('.step-pill');
  const stepPanels = {
    1: document.getElementById('stepPanel1'),
    2: document.getElementById('stepPanel2'),
    3: document.getElementById('stepPanel3'),
    4: document.getElementById('stepPanel4')
  };

  // 초기 상태(1~2단계)에서는 유성펜 그림 숨김 (3단계에서 표시)
  sim3D.strawDecalMesh.visible = false;
  sim3D.bottleDecoMesh.visible = false;

  function setLabStep(stepNum) {
    sfx.playClick();
    sim3D.state.labStep = stepNum;
    stepPills.forEach((p) => p.classList.toggle('active', Number(p.dataset.labstep) === stepNum));
    Object.keys(stepPanels).forEach((k) => {
      stepPanels[k].classList.toggle('active', Number(k) === stepNum);
    });

    if (stepNum >= 2) {
      completeStep1Silently();
      // 2단계 진입 시 클립이 바로 화면에 나타나도록 설정
      sim3D.state.isClipsHooked = true;
      btnHookClips.classList.add('done');
    }
    if (stepNum >= 3) {
      completeStep2Silently();
      sim3D.strawDecalMesh.visible = true;
      sim3D.bottleDecoMesh.visible = true;
    } else {
      sim3D.strawDecalMesh.visible = false;
      sim3D.bottleDecoMesh.visible = false;
    }
  }

  stepPills.forEach((pill) => {
    pill.addEventListener('click', () => setLabStep(Number(pill.dataset.labstep)));
  });

  // --- STEP 1 버튼들 ---
  const btnBendStraw = document.getElementById('btnBendStraw');
  const btnCutStraw = document.getElementById('btnCutStraw');
  const btnTapeStraw = document.getElementById('btnTapeStraw');
  const btnToStep2 = document.getElementById('btnToStep2');

  function completeStep1Silently() {
    sim3D.state.isBent = true;
    sim3D.state.isCut = true;
    sim3D.state.isTaped = true;
    btnBendStraw.classList.add('done');
    btnCutStraw.disabled = false;
    btnCutStraw.classList.add('done');
    btnTapeStraw.disabled = false;
    btnTapeStraw.classList.add('done');
    btnToStep2.disabled = false;
  }

  btnBendStraw.addEventListener('click', () => {
    sfx.playBendStraw();
    sim3D.state.isBent = true;
    btnBendStraw.classList.add('done');
    btnCutStraw.disabled = false;
  });

  btnCutStraw.addEventListener('click', () => {
    sfx.playSnip();
    sim3D.triggerScissorsCut();
    btnCutStraw.classList.add('done');
    btnTapeStraw.disabled = false;
  });

  btnTapeStraw.addEventListener('click', () => {
    sfx.playClick();
    sim3D.state.isTaped = true;
    btnTapeStraw.classList.add('done');
    btnToStep2.disabled = false;
  });

  btnToStep2.addEventListener('click', () => setLabStep(2));

  // --- STEP 2 버튼들 & 클립 개수 튜너 ---
  const btnHookClips = document.getElementById('btnHookClips');
  const btnInsertClipStraw = document.getElementById('btnInsertClipStraw');
  const btnToStep3 = document.getElementById('btnToStep3');
  const sliderClipCount = document.getElementById('sliderClipCount');
  const sliderStep4ClipCount = document.getElementById('sliderStep4ClipCount');
  const clipCountLabel = document.getElementById('clipCountLabel');
  const step4ClipCount = document.getElementById('step4ClipCount');

  function completeStep2Silently() {
    sim3D.state.isClipsHooked = true;
    sim3D.state.isClipInserted = true;
    btnHookClips.classList.add('done');
    btnInsertClipStraw.disabled = false;
    btnInsertClipStraw.classList.add('done');
    btnToStep3.disabled = false;
  }

  btnHookClips.addEventListener('click', () => {
    sfx.playClipClink();
    sim3D.state.isClipsHooked = true;
    btnHookClips.classList.add('done');
    btnInsertClipStraw.disabled = false;
  });

  btnInsertClipStraw.addEventListener('click', () => {
    sfx.playClipClink();
    sim3D.state.isClipsHooked = true;
    sim3D.state.isClipInserted = true;
    btnHookClips.classList.add('done');
    btnInsertClipStraw.classList.add('done');
    btnToStep3.disabled = false;
  });

  function updateClipCountUI(newCount) {
    const c = Math.max(1, Math.min(6, Number(newCount)));
    sfx.playClipClink();
    // 클립 개수를 조절하면 즉시 클립이 표시되고 빨대에 끼워진 상태로 반영
    sim3D.state.isClipsHooked = true;
    sim3D.state.isClipInserted = true;
    btnHookClips.classList.add('done');
    btnInsertClipStraw.disabled = false;
    btnInsertClipStraw.classList.add('done');
    btnToStep3.disabled = false;

    sim3D.rebuildHangingClips(c);
    sliderClipCount.value = c;
    if (sliderStep4ClipCount) sliderStep4ClipCount.value = c;
    clipCountLabel.textContent = `${c}개`;
    step4ClipCount.textContent = `${c}개`;
  }

  sliderClipCount.addEventListener('input', (e) => updateClipCountUI(e.target.value));
  if (sliderStep4ClipCount) {
    sliderStep4ClipCount.addEventListener('input', (e) => updateClipCountUI(e.target.value));
  }
  document.getElementById('btnClipMinus').addEventListener('click', () => updateClipCountUI(sim3D.state.hangingClipCount - 1));
  document.getElementById('btnClipPlus').addEventListener('click', () => updateClipCountUI(sim3D.state.hangingClipCount + 1));
  document.getElementById('btnStep4ClipDec').addEventListener('click', () => updateClipCountUI(sim3D.state.hangingClipCount - 1));
  document.getElementById('btnStep4ClipInc').addEventListener('click', () => updateClipCountUI(sim3D.state.hangingClipCount + 1));

  btnToStep3.addEventListener('click', () => setLabStep(3));
  document.getElementById('btnToStep4').addEventListener('click', () => setLabStep(4));

  // --- STEP 4: 물에 넣기, 뚜껑 닫기, 페트병 세게 누르기 ---
  const btnPutSquidInBottle = document.getElementById('btnPutSquidInBottle');
  const btnCloseBottleCap = document.getElementById('btnCloseBottleCap');
  const btnHoldSqueeze = document.getElementById('btnHoldSqueeze');
  const sliderSqueeze = document.getElementById('sliderSqueeze');
  const squeezePercentBadge = document.getElementById('squeezePercentBadge');

  btnPutSquidInBottle.addEventListener('click', () => {
    completeStep1Silently();
    completeStep2Silently();
    sfx.playSplash();
    sim3D.state.isInBottle = true;
    sim3D.state.squidY = 2.82;
    btnPutSquidInBottle.classList.add('done');
    btnCloseBottleCap.disabled = false;
    btnHoldSqueeze.disabled = false;
    sliderSqueeze.disabled = false;
  });

  btnCloseBottleCap.addEventListener('click', () => {
    sfx.playClick();
    sim3D.state.isCapClosed = !sim3D.state.isCapClosed;
    btnCloseBottleCap.classList.toggle('done', sim3D.state.isCapClosed);
    btnCloseBottleCap.querySelector('span:last-child').textContent = sim3D.state.isCapClosed
      ? '🔒 페트병 뚜껑 닫힘 (클릭 시 열기)'
      : '🔓 페트병 뚜껑 열림 (클릭 시 닫기)';
  });

  function setSqueezePercent(pct) {
    const clamped = Math.max(0, Math.min(100, Number(pct)));
    sliderSqueeze.value = clamped;
    squeezePercentBadge.textContent = `압력 ${Math.round(clamped)}%`;
    sim3D.state.targetSqueeze = clamped / 100;
  }

  sim3D.onDirectSqueezeChange = (pct) => {
    setSqueezePercent(pct);
    btnHoldSqueeze.classList.toggle('squeezing', pct > 0);
  };

  const startHoldSqueeze = (e) => {
    if (btnHoldSqueeze.disabled) return;
    if (e) e.preventDefault();
    btnHoldSqueeze.classList.add('squeezing');
    setSqueezePercent(95);
  };

  const stopHoldSqueeze = () => {
    if (btnHoldSqueeze.disabled) return;
    btnHoldSqueeze.classList.remove('squeezing');
    setSqueezePercent(0);
  };

  btnHoldSqueeze.addEventListener('mousedown', startHoldSqueeze);
  btnHoldSqueeze.addEventListener('touchstart', startHoldSqueeze, { passive: false });
  window.addEventListener('mouseup', stopHoldSqueeze);
  window.addEventListener('touchend', stopHoldSqueeze);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !btnHoldSqueeze.disabled) {
      e.preventDefault();
      btnHoldSqueeze.classList.add('squeezing');
      setSqueezePercent(95);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && !btnHoldSqueeze.disabled) {
      e.preventDefault();
      btnHoldSqueeze.classList.remove('squeezing');
      setSqueezePercent(0);
    }
  });

  sliderSqueeze.addEventListener('input', (e) => {
    setSqueezePercent(e.target.value);
  });

  // 카메라 뷰 전환 & 초기화
  document.querySelectorAll('.cam-btn[data-cam]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.playClick();
      document.querySelectorAll('.cam-btn[data-cam]').forEach((b) => b.classList.toggle('active', b === btn));
      sim3D.setCameraView(btn.dataset.cam);
    });
  });

  document.getElementById('btnResetExperiment').addEventListener('click', () => {
    sfx.playClick();
    sim3D.rebuildHangingClips(3);
    sliderClipCount.value = 3;
    if (sliderStep4ClipCount) sliderStep4ClipCount.value = 3;
    clipCountLabel.textContent = '3개';
    step4ClipCount.textContent = '3개';

    sim3D.state.isBent = false;
    sim3D.state.isCut = false;
    sim3D.state.isTaped = false;
    sim3D.state.isClipsHooked = false;
    sim3D.state.isClipInserted = false;
    sim3D.state.isInBottle = false;
    sim3D.state.isCapClosed = false;
    setSqueezePercent(0);

    [btnBendStraw, btnCutStraw, btnTapeStraw, btnHookClips, btnInsertClipStraw, btnPutSquidInBottle, btnCloseBottleCap].forEach((b) => {
      b.classList.remove('done');
    });
    btnCloseBottleCap.querySelector('span:last-child').textContent = '🔄 페트병 뚜껑 닫기 / 열기';
    btnCutStraw.disabled = true;
    btnTapeStraw.disabled = true;
    btnCloseBottleCap.disabled = true;
    btnHoldSqueeze.disabled = true;
    sliderSqueeze.disabled = true;
    setLabStep(1);
    sim3D.setCameraView('front');
  });

  // ==========================================
  // 5. 실시간 빨대 단면 뷰 (X-Ray Canvas)
  // ==========================================
  const xrayCanvas = document.getElementById('xrayCanvas');
  const xCtx = xrayCanvas.getContext('2d');

  function renderXRay() {
    requestAnimationFrame(renderXRay);

    const st = sim3D.state;
    const airPct = Math.round(st.airVolumeRatio * 100);

    const w = xrayCanvas.width;
    const h = xrayCanvas.height;
    xCtx.clearRect(0, 0, w, h);

    const waterSurfaceY = 44 - st.squeeze * 8;

    // 페트병 물 위 기체 영역
    xCtx.fillStyle = 'rgba(254, 240, 138, 0.22)';
    xCtx.fillRect(14, 10, w - 28, waterSurfaceY - 10);
    xCtx.fillStyle = '#fde047';
    xCtx.font = 'bold 10px "Noto Sans KR"';
    xCtx.textAlign = 'center';
    xCtx.fillText('물 위 기체(공기)', w / 2, 26);

    // 페트병 물 영역
    const waterGrad = xCtx.createLinearGradient(0, waterSurfaceY, 0, h - 10);
    waterGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    waterGrad.addColorStop(1, 'rgba(3, 105, 161, 0.55)');
    xCtx.fillStyle = waterGrad;
    xCtx.fillRect(14, waterSurfaceY, w - 28, h - 10 - waterSurfaceY);

    xCtx.strokeStyle = '#7dd3fc';
    xCtx.lineWidth = 1.5;
    xCtx.beginPath();
    xCtx.moveTo(14, waterSurfaceY);
    xCtx.lineTo(w - 14, waterSurfaceY);
    xCtx.stroke();

    // U자 주름 빨대 단면
    const centerX = w / 2;
    const archTopY = 66 + (st.isInBottle ? (2.85 - st.squidY) * 15 : 0);
    const legHeight = 96;
    const legHalfGap = 30;
    const legWidth = 20;

    const waterFillRatio = st.isInBottle ? st.waterInStrawRatio : 0.0;
    const waterFillPx = legHeight * waterFillRatio;
    const airBottomY = archTopY + legHeight - waterFillPx;

    // 빨대 내부 기체(공기)
    xCtx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    xCtx.beginPath();
    xCtx.arc(centerX, archTopY + 18, legHalfGap + legWidth / 2, Math.PI, 0, false);
    xCtx.arc(centerX, archTopY + 18, legHalfGap - legWidth / 2, 0, Math.PI, true);
    xCtx.closePath();
    xCtx.fill();

    const airLegH = Math.max(0, (archTopY + legHeight - waterFillPx) - (archTopY + 18));
    xCtx.fillRect(centerX - legHalfGap - legWidth / 2, archTopY + 18, legWidth, airLegH);
    xCtx.fillRect(centerX + legHalfGap - legWidth / 2, archTopY + 18, legWidth, airLegH);

    // 빨대 내부로 들어온 물
    if (waterFillPx > 0) {
      xCtx.fillStyle = '#0284c7';
      xCtx.fillRect(centerX - legHalfGap - legWidth / 2, airBottomY, legWidth, waterFillPx);
      xCtx.fillRect(centerX + legHalfGap - legWidth / 2, airBottomY, legWidth, waterFillPx);
    }

    xCtx.strokeStyle = '#f8fafc';
    xCtx.lineWidth = 2;
    xCtx.strokeRect(centerX - legHalfGap - legWidth / 2, archTopY + 18, legWidth, legHeight - 18);
    xCtx.strokeRect(centerX + legHalfGap - legWidth / 2, archTopY + 18, legWidth, legHeight - 18);

    xCtx.fillStyle = '#fef08a';
    xCtx.font = 'bold 10px "Noto Sans KR"';
    xCtx.fillText(`빨대 안 기체 (${airPct}%)`, centerX, archTopY - 6);

    const clipBottomY = archTopY + legHeight + 14;
    xCtx.fillStyle = '#e2e8f0';
    xCtx.font = 'bold 10px "Noto Sans KR"';
    xCtx.fillText(`📎 다리 클립: ${st.hangingClipCount}개`, centerX, clipBottomY);
  }

  renderXRay();
});
