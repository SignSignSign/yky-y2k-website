(function () {
    'use strict';

    var PAGE_W = 1.34;
    var PAGE_H = 1.82;
    var PAGE_D = 0.055;
    var PAGE_COUNT = 12;
    var BLANK_INDEX = PAGE_COUNT - 1;
    var COLORS = ['#f6b6d6', '#bed8f1', '#ddc4ef', '#bce2cb', '#f1d6aa', '#f4c3ae'];
    var canvasTextureOptions = { anisotropy: 4 };

    window.addEventListener('error', function (event) {
        document.documentElement.setAttribute('data-runtime-error', (event.message || 'error') + ' @ ' + (event.filename || '') + ':' + (event.lineno || 0));
    });
    window.addEventListener('unhandledrejection', function (event) {
        document.documentElement.setAttribute('data-runtime-rejection', String(event.reason));
    });

    function makeCanvasTexture(canvas) {
        var texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = canvasTextureOptions.anisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        var chars = String(text || '').split('');
        var line = '';
        var lines = [];
        for (var i = 0; i < chars.length; i++) {
            var test = line + chars[i];
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = chars[i];
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        if (maxLines && lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '...';
        }
        lines.forEach(function (item, index) {
            ctx.fillText(item, x, y + index * lineHeight);
        });
    }

    function drawPixelCorners(ctx, width, height, color) {
        ctx.fillStyle = color;
        var size = 16;
        var gap = 25;
        for (var i = 0; i < 3; i++) {
            ctx.fillRect(gap + i * 21, gap, size, size);
            ctx.fillRect(width - gap - size - i * 21, height - gap - size, size, size);
        }
        ctx.fillRect(gap, gap + 21, size, size);
        ctx.fillRect(width - gap - size, height - gap - size - 21, size, size);
    }

    function cleanTitle(title) {
        return String(title || 'UNTITLED')
            .replace(/\.(exe|pkg|url|mov)$/i, '')
            .replace(/_/g, ' ');
    }

    function createShadowTexture() {
        var canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 350;
        var ctx = canvas.getContext('2d');
        ctx.shadowColor = 'rgba(36, 10, 28, 0.72)';
        ctx.shadowBlur = 28;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 15;
        ctx.fillStyle = 'rgba(44, 13, 35, 0.42)';
        ctx.fillRect(34, 30, 188, 292);
        return makeCanvasTexture(canvas);
    }

    function createBackTexture() {
        var canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 700;
        var ctx = canvas.getContext('2d');
        var pearl = ctx.createLinearGradient(20, 20, 500, 690);
        pearl.addColorStop(0, '#d4c5ff');
        pearl.addColorStop(0.22, '#ffb9dc');
        pearl.addColorStop(0.46, '#c5efff');
        pearl.addColorStop(0.68, '#fff0c7');
        pearl.addColorStop(0.86, '#efa8dd');
        pearl.addColorStop(1, '#b9c9ff');
        ctx.fillStyle = pearl;
        ctx.fillRect(0, 0, 512, 700);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (var band = -260; band < 760; band += 88) {
            var shine = ctx.createLinearGradient(band, 0, band + 210, 700);
            shine.addColorStop(0, 'rgba(255,255,255,0)');
            shine.addColorStop(0.48, 'rgba(255,255,255,.35)');
            shine.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = shine;
            ctx.beginPath();
            ctx.moveTo(band, 0);
            ctx.lineTo(band + 150, 0);
            ctx.lineTo(band + 470, 700);
            ctx.lineTo(band + 320, 700);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,.24)';
        for (var y = 26; y < 700; y += 34) {
            for (var x = 26; x < 512; x += 34) {
                ctx.fillRect(x, y, 3, 3);
            }
        }

        var halo = ctx.createRadialGradient(256, 344, 24, 256, 344, 205);
        halo.addColorStop(0, 'rgba(255,255,255,.72)');
        halo.addColorStop(0.42, 'rgba(255,238,251,.22)');
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(45, 120, 422, 450);

        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.lineWidth = 11;
        ctx.strokeRect(20, 20, 472, 660);
        ctx.strokeStyle = 'rgba(129,72,150,.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(38, 38, 436, 624);
        drawPixelCorners(ctx, 512, 700, 'rgba(255,255,255,.84)');

        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(256, 344, 130, 164, Math.PI * 0.08, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(117,84,159,.34)';
        ctx.beginPath();
        ctx.ellipse(256, 344, 112, 146, -Math.PI * 0.08, 0, Math.PI * 2);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,.96)';
        ctx.shadowColor = 'rgba(84,41,103,.38)';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 64px Courier New';
        ctx.fillText('YKY', 256, 326);
        ctx.font = 'bold 21px Courier New';
        ctx.fillText('MY WORKS ARCHIVE', 256, 365);
        ctx.font = 'bold 74px Courier New';
        ctx.fillText('+', 256, 484);
        ctx.shadowBlur = 0;
        return makeCanvasTexture(canvas);
    }

    function createCoverTexture(work, index, color, onReady) {
        var canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 700;
        var ctx = canvas.getContext('2d');
        var blank = index === BLANK_INDEX;
        var label = blank ? '待制作作品' : cleanTitle(work.title);
        var number = String(index + 1).padStart(2, '0');

        function drawPaperBase() {
            var base = ctx.createLinearGradient(0, 0, 512, 700);
            base.addColorStop(0, blank ? '#fff1f8' : color);
            base.addColorStop(1, blank ? '#ffcce4' : '#ffe4f1');
            ctx.fillStyle = base;
            ctx.fillRect(0, 0, 512, 700);

            ctx.fillStyle = blank ? 'rgba(218,68,139,.08)' : 'rgba(255,255,255,.18)';
            for (var yy = 34; yy < 700; yy += 32) {
                for (var xx = 34; xx < 512; xx += 32) {
                    ctx.fillRect(xx, yy, 3, 3);
                }
            }
        }

        function drawFrame() {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 12;
            ctx.strokeRect(15, 15, 482, 670);
            ctx.strokeStyle = 'rgba(190,52,122,.58)';
            ctx.lineWidth = 2;
            ctx.strokeRect(31, 31, 450, 638);
            drawPixelCorners(ctx, 512, 700, blank ? 'rgba(214,64,130,.26)' : 'rgba(255,255,255,.7)');
        }

        function drawIndex() {
            ctx.fillStyle = blank ? '#d64082' : '#482138';
            ctx.fillRect(39, 43, 58, 38);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 22px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(number, 68, 70);
        }

        function drawTitleOverlay() {
            var fade = ctx.createLinearGradient(0, 430, 0, 700);
            fade.addColorStop(0, 'rgba(52,17,38,0)');
            fade.addColorStop(0.52, 'rgba(52,17,38,.72)');
            fade.addColorStop(1, 'rgba(41,13,30,.94)');
            ctx.fillStyle = fade;
            ctx.fillRect(0, 390, 512, 310);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffc7e4';
            ctx.font = 'bold 15px Courier New';
            ctx.fillText('WORK / ' + number, 55, 526);
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,.58)';
            ctx.shadowBlur = 8;
            ctx.font = 'bold 30px Courier New';
            wrapText(ctx, label, 55, 576, 400, 36, 3);
            ctx.shadowBlur = 0;
        }

        function drawTextCover() {
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255,255,255,.86)';
            ctx.font = 'bold 14px Courier New';
            ctx.fillText('YKY DIGITAL ARCHIVE', 54, 98);

            ctx.fillStyle = 'rgba(84,30,62,.86)';
            ctx.font = 'bold 92px Courier New';
            var initials = label.split(/\s+/).map(function (part) {
                return part.charAt(0);
            }).join('').slice(0, 2).toUpperCase() || 'YK';
            ctx.fillText(initials, 54, 245);

            ctx.strokeStyle = 'rgba(255,255,255,.72)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(56, 285);
            ctx.lineTo(456, 285);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,.9)';
            ctx.font = 'bold 16px Courier New';
            ctx.fillText('WEB EXPERIMENT', 55, 330);
            ctx.fillText('PERSONAL PROJECT', 55, 355);

            ctx.fillStyle = '#4e203d';
            ctx.shadowColor = 'rgba(255,255,255,.34)';
            ctx.shadowBlur = 4;
            ctx.font = 'bold 28px Courier New';
            wrapText(ctx, label, 55, 555, 400, 34, 3);
            ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255,255,255,.9)';
            ctx.font = 'bold 14px Courier New';
            ctx.fillText('CLICK TO INSPECT  +', 55, 641);
        }

        var texture = makeCanvasTexture(canvas);

        if (blank) {
            drawPaperBase();
            ctx.strokeStyle = 'rgba(214,64,130,.18)';
            ctx.lineWidth = 1;
            for (var y = 0; y < 700; y += 32) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                ctx.stroke();
            }
            for (var x = 0; x < 512; x += 32) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 700);
                ctx.stroke();
            }
            drawFrame();
            drawIndex();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#d64082';
            ctx.font = 'bold 22px Courier New';
            ctx.fillText('COMING SOON', 256, 296);
            ctx.font = 'bold 34px Courier New';
            ctx.fillText('待制作作品', 256, 348);
            ctx.strokeStyle = 'rgba(214,64,130,.45)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 8]);
            ctx.strokeRect(84, 404, 344, 144);
            ctx.setLineDash([]);
            ctx.font = 'bold 58px Courier New';
            ctx.fillText('+', 256, 501);
            return texture;
        }

        drawPaperBase();
        drawIndex();

        if (work.img) {
            var image = new Image();
            image.onload = function () {
                var targetRatio = 512 / 700;
                var imageRatio = image.width / image.height;
                var sw = image.width;
                var sh = image.height;
                var sx = 0;
                var sy = 0;
                if (imageRatio > targetRatio) {
                    sw = image.height * targetRatio;
                    sx = (image.width - sw) / 2;
                } else {
                    sh = image.width / targetRatio;
                    sy = (image.height - sh) / 2;
                }

                ctx.clearRect(0, 0, 512, 700);
                ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 512, 700);
                ctx.fillStyle = 'rgba(255,112,180,.09)';
                ctx.fillRect(0, 0, 512, 700);
                drawFrame();
                drawIndex();
                drawTitleOverlay();
                texture.needsUpdate = true;
                if (onReady) onReady();
            };
            image.onerror = function () {
                drawTextCover();
                drawFrame();
                texture.needsUpdate = true;
            };
            image.src = encodeURI(work.img);
        } else {
            drawTextCover();
            drawFrame();
        }

        return texture;
    }

    function createRoundedRectShape(width, height, radius) {
        var halfWidth = width / 2;
        var halfHeight = height / 2;
        var shape = new THREE.Shape();
        shape.moveTo(-halfWidth + radius, -halfHeight);
        shape.lineTo(halfWidth - radius, -halfHeight);
        shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
        shape.lineTo(halfWidth, halfHeight - radius);
        shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
        shape.lineTo(-halfWidth + radius, halfHeight);
        shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
        shape.lineTo(-halfWidth, -halfHeight + radius);
        shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
        return shape;
    }

    function createCardFaceGeometry(width, height, radius) {
        var geometry = new THREE.ShapeGeometry(createRoundedRectShape(width, height, radius), 12);
        var position = geometry.getAttribute('position');
        var uv = geometry.getAttribute('uv');
        for (var i = 0; i < position.count; i++) {
            uv.setXY(
                i,
                (position.getX(i) + width / 2) / width,
                (position.getY(i) + height / 2) / height
            );
        }
        uv.needsUpdate = true;
        return geometry;
    }

    function createCardBodyGeometry(width, height, radius, depth, bevel) {
        var geometry = new THREE.ExtrudeGeometry(createRoundedRectShape(width, height, radius), {
            depth: depth,
            steps: 1,
            curveSegments: 12,
            bevelEnabled: true,
            bevelSegments: 3,
            bevelSize: bevel,
            bevelThickness: bevel * 0.72
        });
        geometry.center();
        geometry.computeBoundingBox();
        return geometry;
    }

    function createPage(work, index, backMaterial, edgeMaterial, shadowMaterial) {
        var color = COLORS[index % COLORS.length];
        var frontTexture = createCoverTexture(work, index, color);
        var frontMaterial = new THREE.MeshPhysicalMaterial({
            map: frontTexture,
            color: 0xffffff,
            emissive: 0xffd4e9,
            emissiveIntensity: 0.025,
            roughness: 0.46,
            metalness: 0.015,
            clearcoat: 0.28,
            clearcoatRoughness: 0.26
        });
        var bevel = 0.018;
        var bodyWidth = PAGE_W - bevel * 2;
        var bodyHeight = PAGE_H - bevel * 2;
        var bodyRadius = 0.072;
        var geometry = createCardBodyGeometry(bodyWidth, bodyHeight, bodyRadius, PAGE_D, bevel);
        var coverZ = geometry.boundingBox.max.z + 0.0015;
        var faceGeometry = createCardFaceGeometry(bodyWidth, bodyHeight, bodyRadius);
        var frontFace = new THREE.Mesh(faceGeometry, frontMaterial);
        frontFace.position.z = coverZ;
        var backFace = new THREE.Mesh(faceGeometry, backMaterial);
        backFace.position.z = -coverZ;
        backFace.rotation.y = Math.PI;
        var mesh = new THREE.Mesh(geometry, edgeMaterial);
        mesh.add(frontFace);
        mesh.add(backFace);
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        var page = new THREE.Group();
        var shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(PAGE_W + 0.18, PAGE_H + 0.18),
            shadowMaterial
        );
        shadow.position.set(0.055, -0.075, -coverZ - 0.012);
        shadow.renderOrder = -1;
        page.add(shadow);
        page.add(mesh);

        var outline = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry, 32),
            new THREE.LineBasicMaterial({
                color: 0xffe4f3,
                transparent: true,
                opacity: 0.24,
                depthTest: true
            })
        );
        page.add(outline);

        var glow = new THREE.Mesh(
            new THREE.PlaneGeometry(PAGE_W + 0.12, PAGE_H + 0.12),
            new THREE.MeshBasicMaterial({
                color: 0xff79bd,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            })
        );
        glow.position.z = -coverZ - 0.018;
        page.add(glow);

        page.userData.index = index;
        page.userData.work = work;
        page.userData.blank = index === BLANK_INDEX;
        page.userData.mesh = mesh;
        page.userData.frontMaterial = frontMaterial;
        page.userData.frontTexture = frontTexture;
        page.userData.outline = outline;
        page.userData.glow = glow;
        page.userData.hover = 0;
        page.userData.hoverTarget = 0;
        page.userData.state = 'idle';
        page.userData.openTriggered = false;
        page.userData.floatPhase = index * 0.79;
        page.userData.baseQuaternion = new THREE.Quaternion();
        mesh.userData.pageRoot = page;
        return page;
    }

    function createToast() {
        var toast = document.getElementById('works-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'works-toast';
            toast.className = 'works-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.textContent = '待制作作品';
            var page = document.getElementById('page-4');
            if (page) page.appendChild(toast);
        }
        return toast;
    }

    window.createFlyingWorksScene = function (api) {
        var scene = api.scene;
        var camera = api.camera;
        var renderer = api.renderer;
        var container = api.container;
        var data = window.WORKS_DATA || [];
        var root = new THREE.Group();
        var pageGroup = new THREE.Group();
        root.add(pageGroup);
        scene.add(root);

        scene.add(new THREE.HemisphereLight(0xffeaf6, 0x563447, 1.7));
        scene.add(new THREE.AmbientLight(0xfff4fb, 0.2));
        var keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
        keyLight.position.set(-3.5, 5.5, 7);
        scene.add(keyLight);
        var faceLight = new THREE.DirectionalLight(0xfff8fc, 0.52);
        scene.add(faceLight);
        scene.add(faceLight.target);
        var blueLight = new THREE.DirectionalLight(0xc9ddff, 0.9);
        blueLight.position.set(5, -2, 2);
        scene.add(blueLight);
        var pinkLight = new THREE.PointLight(0xff68b6, 4.4, 18, 2);
        pinkLight.position.set(3.5, 2.8, 4.5);
        scene.add(pinkLight);

        var backMaterial = new THREE.MeshPhysicalMaterial({
            map: createBackTexture(),
            color: 0xffffff,
            roughness: 0.27,
            metalness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            iridescence: 1,
            iridescenceIOR: 1.46,
            iridescenceThicknessRange: [120, 820],
            sheen: 0.7,
            sheenColor: 0xf7d6ff,
            sheenRoughness: 0.35
        });
        var edgeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf5a9d1,
            roughness: 0.2,
            metalness: 0.62,
            clearcoat: 1,
            clearcoatRoughness: 0.1
        });
        var shadowMaterial = new THREE.MeshBasicMaterial({
            map: createShadowTexture(),
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
            side: THREE.FrontSide
        });

        var angles = [-90, -58, -23, 14, 51, 89, 127, 163, 198, 236, 274, 321];
        var depth = [-0.35, 0.92, 0.12, -1.02, 0.66, -0.42, 1.06, -0.78, 0.3, -0.92, 0.72, -0.18];
        var pages = [];
        var pageMeshes = [];

        for (var i = 0; i < PAGE_COUNT; i++) {
            var work = data[i] || { title: '待制作作品', desc: '开发中' };
            var page = createPage(work, i, backMaterial, edgeMaterial, shadowMaterial);
            var angle = THREE.MathUtils.degToRad(angles[i]);
            var radiusX = 4.42 + Math.sin(i * 1.73) * 0.34;
            var radiusY = 2.56 + Math.cos(i * 1.37) * 0.31;
            page.position.set(
                Math.cos(angle) * radiusX,
                Math.sin(angle) * radiusY,
                depth[i]
            );
            page.rotation.set(
                Math.sin(i * 2.21) * 0.16,
                Math.sin(i * 1.37) * 0.48,
                Math.sin(i * 1.91) * 0.34
            );
            page.scale.setScalar(0.84 + (Math.sin(i * 1.17) + 1) * 0.065);
            page.userData.basePosition = page.position.clone();
            page.userData.baseRotation = page.rotation.clone();
            page.userData.baseQuaternion.copy(page.quaternion);
            page.userData.baseScale = page.scale.x;
            pageGroup.add(page);
            pages.push(page);
            pageMeshes.push(page.userData.mesh);
        }

        var toast = createToast();
        var toastTimer = 0;
        var modal = document.getElementById('detail-modal');
        var raycaster = new THREE.Raycaster();
        var pointer = new THREE.Vector2(10, 10);
        var cameraLocal = new THREE.Vector3();
        var edgeDirection = new THREE.Vector3();
        var hovered = null;
        var selected = null;
        var rootScale = 1;

        function updatePointer(event) {
            var rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }

        function hitPage() {
            raycaster.setFromCamera(pointer, camera);
            var hits = raycaster.intersectObjects(pageMeshes, false);
            return hits.length ? hits[0].object.userData.pageRoot : null;
        }

        function setHovered(page) {
            if (hovered === page) return;
            if (hovered) hovered.userData.hoverTarget = 0;
            hovered = page;
            if (hovered && hovered.userData.state === 'idle') hovered.userData.hoverTarget = 1;
        }

        function showToast(message) {
            if (!toast) return;
            toast.textContent = message;
            toast.classList.add('visible');
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(function () {
                toast.classList.remove('visible');
            }, 1500);
        }

        function beginReturn(page, delay) {
            if (!page) return;
            window.setTimeout(function () {
                if (page.userData.state !== 'presenting') return;
                page.userData.state = 'return';
                page.userData.progress = 0;
                page.userData.startPosition = page.position.clone();
                page.userData.startScale = page.scale.x;
            }, delay || 0);
        }

        function selectPage(page) {
            if (!page || selected) return;
            selected = page;
            hovered = null;
            pages.forEach(function (item) {
                item.userData.hoverTarget = 0;
            });
            page.userData.state = 'extract';
            page.userData.progress = 0;
            page.userData.startPosition = page.position.clone();
            page.userData.startScale = page.scale.x;
            page.userData.openTriggered = false;
        }

        function openPreview(page) {
            if (!page) return;
            if (page.userData.blank) {
                showToast('待制作作品');
                page.userData.state = 'presenting';
                beginReturn(page, 720);
                return;
            }
            if (typeof window.openDrawer === 'function') {
                window.openDrawer('work', page.userData.index);
                page.userData.state = 'presenting';
            } else {
                page.userData.state = 'presenting';
                beginReturn(page, 120);
            }
        }

        renderer.domElement.addEventListener('pointermove', function (event) {
            if (selected) return;
            updatePointer(event);
            setHovered(hitPage());
        }, { passive: true });

        renderer.domElement.addEventListener('pointerleave', function () {
            if (!selected) setHovered(null);
        });

        renderer.domElement.addEventListener('click', function (event) {
            if (selected) return;
            updatePointer(event);
            selectPage(hitPage());
        });

        if (modal && window.MutationObserver) {
            var modalObserver = new MutationObserver(function () {
                if (!modal.classList.contains('active') && selected && selected.userData.state === 'presenting') {
                    beginReturn(selected, 80);
                }
            });
            modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
        }

        function updateExtractedPage(page, t, dt) {
            var p = Math.min(1, page.userData.progress + dt * 1.9);
            page.userData.progress = p;
            var eased = 1 - Math.pow(1 - p, 3);
            var base = page.userData.basePosition;

            root.updateMatrixWorld(true);
            cameraLocal.copy(camera.position);
            root.worldToLocal(cameraLocal);
            edgeDirection.copy(cameraLocal).sub(base).normalize();
            var target = base.clone().add(edgeDirection.multiplyScalar(2.35));
            target.z += 0.34;
            page.position.lerpVectors(page.userData.startPosition, target, eased);
            page.scale.setScalar(page.userData.startScale + (page.userData.baseScale * 0.34) * eased);

            var before = page.quaternion.clone();
            page.lookAt(camera.position);
            var facing = page.quaternion.clone();
            page.quaternion.copy(before).slerp(facing, Math.min(1, dt * 8 + 0.08));

            page.userData.frontMaterial.emissiveIntensity += (0.2 - page.userData.frontMaterial.emissiveIntensity) * 0.16;
            page.userData.outline.material.opacity = 1;
            page.userData.glow.material.opacity = 0.16 + Math.sin(t * 5) * 0.04;

            if (p >= 1 && !page.userData.openTriggered) {
                page.userData.openTriggered = true;
                window.setTimeout(function () {
                    openPreview(page);
                }, 70);
            }
        }

        return function update(t, dt) {
            var aspect = camera.aspect || 1;
            var targetRootScale = aspect < 0.72 ? 0.82 : (aspect < 1.05 ? 0.9 : 1);
            rootScale += (targetRootScale - rootScale) * 0.08;
            root.scale.setScalar(rootScale);

            root.rotation.y += dt * 0.055;
            root.rotation.x = -0.025 + Math.sin(t * 0.12) * 0.012;
            root.rotation.z = Math.cos(t * 0.1) * 0.014;
            faceLight.position.copy(camera.position);
            faceLight.target.position.set(0, 0, 0);
            faceLight.target.updateMatrixWorld();

            pages.forEach(function (page) {
                var state = page.userData.state;
                page.userData.hover += (page.userData.hoverTarget - page.userData.hover) * 0.14;
                var hover = page.userData.hover;
                page.userData.outline.material.opacity = 0.2 + hover * 0.68;
                page.userData.glow.material.opacity = hover * 0.16;
                page.userData.frontMaterial.emissiveIntensity = 0.025 + hover * 0.18;

                if (state === 'idle') {
                    var phase = page.userData.floatPhase;
                    var base = page.userData.basePosition;
                    page.position.set(
                        base.x + Math.cos(t * 0.48 + phase) * 0.055,
                        base.y + Math.sin(t * 0.74 + phase) * 0.105,
                        base.z + Math.sin(t * 0.57 + phase) * 0.07
                    );
                    page.rotation.set(
                        page.userData.baseRotation.x + Math.sin(t * 0.51 + phase) * 0.032,
                        page.userData.baseRotation.y + Math.cos(t * 0.39 + phase) * 0.028,
                        page.userData.baseRotation.z + Math.sin(t * 0.61 + phase) * 0.038
                    );
                    page.scale.setScalar(page.userData.baseScale * (1 + hover * 0.065));
                } else if (state === 'extract') {
                    updateExtractedPage(page, t, dt);
                } else if (state === 'presenting') {
                    page.userData.outline.material.opacity = 0.82;
                    page.userData.glow.material.opacity = 0.12 + Math.sin(t * 4.2) * 0.025;
                    page.scale.setScalar(page.userData.baseScale * 1.34);
                } else if (state === 'return') {
                    page.userData.progress = Math.min(1, page.userData.progress + dt * 1.75);
                    var rp = page.userData.progress;
                    var re = 1 - Math.pow(1 - rp, 3);
                    page.position.lerpVectors(page.userData.startPosition, page.userData.basePosition, re);
                    var startScale = page.userData.startScale || page.userData.baseScale;
                    page.scale.setScalar(startScale + (page.userData.baseScale - startScale) * re);
                    page.quaternion.slerp(page.userData.baseQuaternion, Math.min(1, dt * 9 + 0.05));
                    if (rp >= 1) {
                        page.userData.state = 'idle';
                        page.userData.openTriggered = false;
                        page.rotation.copy(page.userData.baseRotation);
                        selected = null;
                    }
                }
            });
        };
    };

    var bootPage = new URLSearchParams(window.location.search).get('page');
    if (bootPage) {
        window.setTimeout(function () {
            if (typeof window.switchPage === 'function') window.switchPage(Number(bootPage));
        }, 0);
    }
})();
