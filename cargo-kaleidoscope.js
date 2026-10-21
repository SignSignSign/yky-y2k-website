(function () {
    'use strict';

    var canvas = document.getElementById('cargo-kaleidoscope-bg');
    if (!canvas) return;

    var gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false
    }) || canvas.getContext('experimental-webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        premultipliedAlpha: false
    });

    if (!gl) {
        canvas.style.display = 'none';
        return;
    }

    // Stop the old Canvas 2D approximation only after WebGL is available.
    window.__cargoKaleidoscope = true;
    var oldCanvas = document.getElementById('kaleidoscope-bg');
    if (oldCanvas) oldCanvas.style.display = 'none';

    var VERTEX_SHADER = [
        'attribute vec2 position;',
        'void main() {',
        '    gl_Position = vec4(position, 0.0, 1.0);',
        '}'
    ].join('\n');

    // Mirrors Cargo's public kaleidoscope shader and default parameters.
    var FRAGMENT_SHADER = [
        '#ifdef GL_FRAGMENT_PRECISION_HIGH',
        'precision highp float;',
        '#else',
        'precision mediump float;',
        '#endif',
        'uniform sampler2D uSampler;',
        'uniform float time;',
        'uniform float baseRotation1;',
        'uniform float rotationSpeed1;',
        'uniform float baseRotation2;',
        'uniform float rotationSpeed2;',
        'uniform float sliceAngle;',
        'uniform float mirrorSlices;',
        'uniform vec2 zoom;',
        'uniform vec2 resolution;',
        'uniform vec2 aspect;',
        'uniform vec2 center;',
        'uniform vec2 mouseOffset;',
        'uniform bool pinch;',
        'void main(void) {',
        '    vec2 position = -aspect.xy + 2.0 * gl_FragCoord.xy / resolution.xy * aspect.xy;',
        '    float radius = length(position);',
        '    float angle = atan(position.y, position.x) + baseRotation1;',
        '    float slice = mod(angle + time * rotationSpeed1, sliceAngle * 2.0);',
        '    if (mirrorSlices * slice > sliceAngle) {',
        '        slice = 2.0 * sliceAngle - slice;',
        '    }',
        '    if (pinch) {',
        '        float rot2 = baseRotation2 + time * rotationSpeed2;',
        '        rot2 = atan(position.y, position.x) + baseRotation2 + time * rotationSpeed2;',
        '        gl_FragColor = texture2D(uSampler, (center + length(center) * vec2(cos(rot2), sin(rot2)) + mouseOffset + vec2(cos(slice), sin(slice)) * radius) * zoom);',
        '    } else {',
        '        float rot2 = baseRotation2 + time * rotationSpeed2;',
        '        vec2 rot = vec2(sin(rot2), cos(rot2));',
        '        vec2 pos = vec2(cos(slice), sin(slice)) * radius + center;',
        '        gl_FragColor = texture2D(uSampler, (vec2(pos.x * rot.y + pos.y * rot.x, pos.y * rot.y - pos.x * rot.x)) * zoom + mouseOffset, -1.0);',
        '    }',
        '}'
    ].join('\n');

    function compileShader(type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    var vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    var fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1, -1,
         1,  1,
        -1,  1
    ]), gl.STATIC_DRAW);

    var positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    var uniforms = {
        sampler: gl.getUniformLocation(program, 'uSampler'),
        time: gl.getUniformLocation(program, 'time'),
        baseRotation1: gl.getUniformLocation(program, 'baseRotation1'),
        rotationSpeed1: gl.getUniformLocation(program, 'rotationSpeed1'),
        baseRotation2: gl.getUniformLocation(program, 'baseRotation2'),
        rotationSpeed2: gl.getUniformLocation(program, 'rotationSpeed2'),
        sliceAngle: gl.getUniformLocation(program, 'sliceAngle'),
        mirrorSlices: gl.getUniformLocation(program, 'mirrorSlices'),
        zoom: gl.getUniformLocation(program, 'zoom'),
        resolution: gl.getUniformLocation(program, 'resolution'),
        aspect: gl.getUniformLocation(program, 'aspect'),
        center: gl.getUniformLocation(program, 'center'),
        mouseOffset: gl.getUniformLocation(program, 'mouseOffset'),
        pinch: gl.getUniformLocation(program, 'pinch')
    };

    var settings = {
        slices: 18,
        zoom: 217,
        baseRotation1: 61,
        rotationSpeed1: -8,
        baseRotation2: -148,
        rotationSpeed2: -8,
        rotationCenterX: 21,
        rotationCenterY: 66,
        mirrorSlices: true,
        pinch: false
    };

    var texture = null;
    var textureRatio = 1;
    var textureReady = false;
    var visible = true;
    var W = 0;
    var H = 0;
    var dpr = 1;
    var startTime = performance.now();
    var mouseOffsetLimit = 0.15;
    var lastFrameTime = 0;
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    function isPowerOfTwo(value) {
        return value > 0 && (value & (value - 1)) === 0;
    }

    function nextPowerOfTwo(value) {
        var result = 1;
        while (result < value) result *= 2;
        return result;
    }

    function buildFallbackTexture() {
        var fallback = document.createElement('canvas');
        fallback.width = 1024;
        fallback.height = 1024;
        var ctx = fallback.getContext('2d');
        var gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
        gradient.addColorStop(0, '#4d62d1');
        gradient.addColorStop(0.55, '#d58bc6');
        gradient.addColorStop(1, '#ffe4c8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 1024);
        return fallback;
    }

    function uploadTexture(image) {
        var imageWidth = image.naturalWidth || image.width;
        var imageHeight = image.naturalHeight || image.height;
        if (!imageWidth || !imageHeight) return;

        var source = image;
        if (!isPowerOfTwo(imageWidth) || !isPowerOfTwo(imageHeight)) {
            var padded = document.createElement('canvas');
            padded.width = nextPowerOfTwo(imageWidth);
            padded.height = nextPowerOfTwo(imageHeight);
            padded.getContext('2d').drawImage(
                image,
                0, 0, imageWidth, imageHeight,
                0, 0, padded.width, padded.height
            );
            source = padded;
        }

        textureRatio = imageHeight / imageWidth;

        if (texture) gl.deleteTexture(texture);
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);

        textureReady = true;
    }

    var textureImage = new Image();
    textureImage.onload = function () {
        uploadTexture(textureImage);
    };
    textureImage.onerror = function () {
        uploadTexture(buildFallbackTexture());
    };
    textureImage.src = 'bubble.png';

    function resize() {
        W = Math.max(1, window.innerWidth);
        H = Math.max(1, window.innerHeight);
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('pointermove', function (event) {
        var normalizedX = Math.max(-1, Math.min(1, event.clientX / W * 2 - 1));
        var normalizedY = Math.max(-1, Math.min(1, event.clientY / H * 2 - 1));
        mouse.tx = normalizedX * mouseOffsetLimit;
        mouse.ty = normalizedY * mouseOffsetLimit;
    }, { passive: true });

    resize();
    gl.clearColor(1.0, 0.88, 0.94, 1.0);

    function render(now) {
        requestAnimationFrame(render);
        if (!visible || !textureReady) return;

        var dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 1 / 30) : 1 / 60;
        lastFrameTime = now;
        var mouseEase = 1 - Math.pow(0.91, dt * 60);
        mouse.x += (mouse.tx - mouse.x) * mouseEase;
        mouse.y += (mouse.ty - mouse.y) * mouseEase;

        var time = (now - startTime) / 1000;
        var sliceAngle = Math.PI * 2 / settings.slices;

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform1f(uniforms.time, time);
        gl.uniform1f(uniforms.sliceAngle, sliceAngle);
        gl.uniform1f(uniforms.baseRotation1, settings.baseRotation1 / 180 * Math.PI);
        gl.uniform1f(uniforms.rotationSpeed1, settings.rotationSpeed1 / 10000 * 50);
        gl.uniform1f(uniforms.baseRotation2, settings.baseRotation2 / 180 * Math.PI);
        gl.uniform1f(uniforms.rotationSpeed2, settings.rotationSpeed2 / 10000 * 50);
        gl.uniform1f(uniforms.mirrorSlices, settings.mirrorSlices ? 1.0 : 0.0);
        gl.uniform2f(
            uniforms.zoom,
            1.5 / (settings.zoom / 100) * textureRatio,
            1.5 / (settings.zoom / 100)
        );
        gl.uniform2f(uniforms.center, settings.rotationCenterX / 100, settings.rotationCenterY / 100);
        gl.uniform2f(
            uniforms.mouseOffset,
            mouse.x,
            mouse.y
        );
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.aspect, W / H, 1.0);
        gl.uniform1i(uniforms.pinch, settings.pinch ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uniforms.sampler, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    window.setKaleidoscope = function (on) {
        visible = !!on;
        canvas.style.opacity = on ? '1' : '0';
    };

    requestAnimationFrame(render);
})();
