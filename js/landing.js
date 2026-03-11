/* ============================================
   NovaPath — Landing Page 3D Scene
   Three.js orbital visualization
   ============================================ */

let scene, camera, renderer, raycaster, mouse;
let orbitGroup, dayMeshes = [], glowMeshes = [];
let hoveredIndex = -1;
let clock;
const DAY_RADIUS = 0.35;
const ORBIT_RADIUS_BASE = 6;
const CENTER_RADIUS = 1.2;

document.addEventListener('DOMContentLoaded', () => {
    init3DScene();
    createModal();
    animate();
});

function init3DScene() {
    const container = document.getElementById('scene-container');
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(-999, -999);

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.02);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x333355, 0.5);
    scene.add(ambientLight);

    // Point light at center
    const centerLight = new THREE.PointLight(0x7b2ff7, 2, 20);
    centerLight.position.set(0, 0, 0);
    scene.add(centerLight);

    // Secondary accent light
    const accentLight = new THREE.PointLight(0x00d4ff, 1, 15);
    accentLight.position.set(3, 3, 3);
    scene.add(accentLight);

    // Create center ISS sphere
    createCenterSphere();

    // Create orbital ring
    createOrbitRing();

    // Create day nodes
    orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    createDayNodes();

    // Create background stars
    createStarfield3D();

    // Events
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('touchstart', onTouchStart, { passive: false });
}

function createCenterSphere() {
    // Main ISS sphere
    const geo = new THREE.SphereGeometry(CENTER_RADIUS, 64, 64);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x1a1a3e,
        emissive: 0x7b2ff7,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2,
        transparent: true,
        opacity: 0.85
    });
    const sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    // Glow ring around center
    const ringGeo = new THREE.TorusGeometry(CENTER_RADIUS + 0.3, 0.03, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.5
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Second ring
    const ring2Geo = new THREE.TorusGeometry(CENTER_RADIUS + 0.6, 0.02, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0x7b2ff7,
        transparent: true,
        opacity: 0.3
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 2.5;
    ring2.rotation.y = 0.3;
    scene.add(ring2);

    // ISS text label using sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 36px Orbitron, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ISS', 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 0;
    scene.add(sprite);
}

function createOrbitRing() {
    const orbitGeo = new THREE.TorusGeometry(ORBIT_RADIUS_BASE, 0.015, 16, 200);
    const orbitMat = new THREE.MeshBasicMaterial({
        color: 0x7b2ff7,
        transparent: true,
        opacity: 0.15
    });
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI / 2;
    scene.add(orbit);

    // Dashed second orbit
    const orbit2Geo = new THREE.TorusGeometry(ORBIT_RADIUS_BASE, 0.008, 16, 200);
    const orbit2Mat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.08
    });
    const orbit2 = new THREE.Mesh(orbit2Geo, orbit2Mat);
    orbit2.rotation.x = Math.PI / 2.2;
    scene.add(orbit2);
}

function createDayNodes() {
    const count = AUDIO_DATA.length;

    AUDIO_DATA.forEach((entry, i) => {
        const angle = (i / count) * Math.PI * 2;

        // Node sphere
        const geo = new THREE.SphereGeometry(DAY_RADIUS, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x1a1a3e,
            emissive: entry.month === 'Feb' ? 0xff6bcb : 0x00d4ff,
            emissiveIntensity: 0.3,
            metalness: 0.6,
            roughness: 0.3,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.x = Math.cos(angle) * ORBIT_RADIUS_BASE;
        mesh.position.z = Math.sin(angle) * ORBIT_RADIUS_BASE;
        mesh.position.y = 0;

        mesh.userData = { index: i, baseScale: 1 };
        orbitGroup.add(mesh);
        dayMeshes.push(mesh);

        // Glow halo
        const glowGeo = new THREE.SphereGeometry(DAY_RADIUS * 1.6, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: entry.month === 'Feb' ? 0xff6bcb : 0x00d4ff,
            transparent: true,
            opacity: 0
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(mesh.position);
        orbitGroup.add(glow);
        glowMeshes.push(glow);

        // Day label sprite
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 24px Orbitron, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entry.dayShort, 96, 28);

        // Small month text
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(entry.month, 96, 50);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.2, 0.4, 1);
        sprite.position.copy(mesh.position);
        sprite.position.y += 0.7;
        orbitGroup.add(sprite);
    });
}

function createStarfield3D() {
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const radius = 30 + Math.random() * 70;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true
    });

    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Update camera slight parallax
    const targetX = mouse.x * 0.5;
    const targetY = 4 + mouse.y * 0.3;
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
}

function onMouseClick(e) {
    if (hoveredIndex >= 0) {
        showDayModal(hoveredIndex);
    }
}

function onTouchStart(e) {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(dayMeshes);
        if (intersects.length > 0) {
            e.preventDefault();
            const idx = intersects[0].object.userData.index;
            showDayModal(idx);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Rotate orbit slowly
    if (orbitGroup) {
        orbitGroup.rotation.y = elapsed * 0.08;
    }

    // Raycast for hover detection
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(dayMeshes);
    const dayLabel = document.getElementById('day-label');
    const sceneContainer = document.getElementById('scene-container');

    if (intersects.length > 0) {
        const idx = intersects[0].object.userData.index;
        if (hoveredIndex !== idx) {
            // Reset previous
            if (hoveredIndex >= 0) {
                resetNodeAppearance(hoveredIndex);
            }
            hoveredIndex = idx;
            highlightNode(idx);
        }

        // Position day label near cursor
        if (dayLabel) {
            dayLabel.textContent = AUDIO_DATA[idx].dayLabel + ' · ' + AUDIO_DATA[idx].time;
            dayLabel.style.left = (intersects[0].point.x !== undefined ?
                ((mouse.x + 1) / 2 * window.innerWidth + 20) : 0) + 'px';
            dayLabel.style.top = (((1 - mouse.y) / 2 * window.innerHeight) - 40) + 'px';
            dayLabel.classList.add('visible');
        }

        if (sceneContainer) sceneContainer.style.cursor = 'pointer';
    } else {
        if (hoveredIndex >= 0) {
            resetNodeAppearance(hoveredIndex);
            hoveredIndex = -1;
        }
        if (dayLabel) dayLabel.classList.remove('visible');
        if (sceneContainer) sceneContainer.style.cursor = 'default';
    }

    // Gentle float animation for day nodes
    dayMeshes.forEach((mesh, i) => {
        mesh.position.y = Math.sin(elapsed * 0.5 + i * 0.5) * 0.15;
        glowMeshes[i].position.y = mesh.position.y;
    });

    renderer.render(scene, camera);
}

function highlightNode(idx) {
    const mesh = dayMeshes[idx];
    const glow = glowMeshes[idx];

    mesh.scale.setScalar(1.4);
    mesh.material.emissiveIntensity = 0.8;
    glow.material.opacity = 0.15;
}

function resetNodeAppearance(idx) {
    const mesh = dayMeshes[idx];
    const glow = glowMeshes[idx];

    mesh.scale.setScalar(1);
    mesh.material.emissiveIntensity = 0.3;
    glow.material.opacity = 0;
}

/* --- Modal --- */
function createModal() {
    // Modal already exists in HTML, just set up events
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function showDayModal(index) {
    const data = AUDIO_DATA[index];
    const overlay = document.getElementById('modal-overlay');

    // Populate modal
    document.getElementById('modal-date-text').textContent = data.dayLabel + ', 2026';
    document.getElementById('modal-time').textContent = data.time;
    document.getElementById('modal-freq').textContent = data.frequency;

    // Audio source
    const audioEl = document.getElementById('modal-audio');
    audioEl.src = `data/audio/${data.file}`;

    // Transcription — use TRANSCRIPTION_DATA manifest matched by index
    const transBox = document.getElementById('modal-transcription');
    const transEntry = (typeof TRANSCRIPTION_DATA !== 'undefined' && TRANSCRIPTION_DATA[index])
        ? TRANSCRIPTION_DATA[index] : null;

    if (transEntry) {
        fetch(`data/transcription/${transEntry.file}?v=${Date.now()}`)
            .then(res => {
                if (res.ok) return res.text();
                throw new Error('Not found');
            })
            .then(text => {
                if (!text || text.trim() === '') {
                    transBox.innerHTML = '<p class="pending">Transcription pending…</p>';
                } else {
                    transBox.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
                }
            })
            .catch(() => {
                transBox.innerHTML = '<p class="pending">Transcription pending…</p>';
            });
    } else {
        transBox.innerHTML = '<p class="pending">Transcription pending…</p>';
    }

    // Show modal
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const audioEl = document.getElementById('modal-audio');

    overlay.classList.remove('active');
    document.body.style.overflow = '';

    // Pause audio
    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
    }
}
