(function () {
    'use strict';

    var API_BASE = '/api/analytics';
    var LOCAL_KEY = 'yky-analytics-v1';
    var VISIT_KEY = 'yky-analytics-visit-counted';
    var backendMode = false;
    var stream = null;
    var disableStream = new URLSearchParams(window.location.search).has('nostream');
    var pollTimer = null;

    var statNodes = {
        total: document.getElementById('stat-total'),
        today: document.getElementById('stat-today'),
        wechat: document.getElementById('stat-wechat'),
        copy: document.getElementById('stat-copy')
    };
    var modeNode = document.getElementById('analytics-mode');
    var syncButton = document.getElementById('analytics-sync');
    var qrModal = document.getElementById('wechat-qr-modal');
    var qrClose = document.getElementById('wechat-qr-close');
    var detailOverlay = document.getElementById('profile-detail-overlay');
    var detailTitle = document.getElementById('profile-detail-title');
    var detailClose = document.getElementById('profile-detail-close');
    var contactPanel = document.getElementById('contact-detail-panel');
    var analyticsPanel = document.getElementById('analytics-detail-panel');
    var contactDetailContent = document.getElementById('contact-detail-content');
    var analyticsDetailContent = document.getElementById('analytics-detail-content');
    var contactButton = document.getElementById('open-contact-panel');
    var analyticsButton = document.getElementById('open-analytics-panel');

    var contactWindow = document.querySelector('.contact-window');
    var qrWindow = document.querySelector('.qr-mini-window');
    var analyticsWindow = document.querySelector('.analytics-window');
    var profileInfoGrid = document.querySelector('.profile-info-grid');

    if (contactWindow && contactDetailContent) contactDetailContent.appendChild(contactWindow);
    if (qrWindow && contactDetailContent) contactDetailContent.appendChild(qrWindow);
    if (analyticsWindow && analyticsDetailContent) analyticsDetailContent.appendChild(analyticsWindow);
    if (profileInfoGrid && !profileInfoGrid.children.length) profileInfoGrid.remove();

    function todayKey() {
        var now = new Date();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        return now.getFullYear() + '-' + month + '-' + day;
    }

    function emptyStats() {
        return { total: 0, today: 0, wechat: 0, copy: 0, date: todayKey() };
    }

    function cleanStats(value) {
        var source = value && typeof value === 'object' ? value : {};
        return {
            total: Number(source.total) || 0,
            today: Number(source.today) || 0,
            wechat: Number(source.wechat) || 0,
            copy: Number(source.copy) || 0,
            date: source.date || todayKey()
        };
    }

    function renderStats(value) {
        var stats = cleanStats(value);
        Object.keys(statNodes).forEach(function (key) {
            if (statNodes[key]) statNodes[key].textContent = stats[key];
        });
    }

    function setMode(label, live) {
        if (modeNode) modeNode.textContent = label;
        var dot = document.querySelector('.live-dot');
        if (dot) dot.style.background = live ? '#58ba73' : '#e3a13a';
    }

    function readLocal() {
        var stats = emptyStats();
        try {
            var stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
            if (stored) stats = cleanStats(stored);
        } catch (error) { }
        if (stats.date !== todayKey()) {
            stats.today = 0;
            stats.date = todayKey();
        }
        return stats;
    }

    function writeLocal(stats) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(stats));
        renderStats(stats);
    }

    function incrementLocal(field) {
        var stats = readLocal();
        stats[field] = (Number(stats[field]) || 0) + 1;
        writeLocal(stats);
    }

    async function request(path, options) {
        var response = await fetch(API_BASE + path, Object.assign({
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        }, options || {}));
        if (!response.ok) throw new Error('analytics request failed');
        return response.json();
    }

    async function refreshBackend() {
        try {
            var stats = await request('');
            renderStats(stats);
            setMode('LIVE · SERVER', true);
            return true;
        } catch (error) {
            return false;
        }
    }

    function startStream() {
        if (!('EventSource' in window)) return;
        if (stream) stream.close();
        stream = new EventSource(API_BASE + '/stream');
        stream.onmessage = function (event) {
            try {
                renderStats(JSON.parse(event.data));
                setMode('LIVE · SERVER', true);
            } catch (error) { }
        };
        stream.onerror = function () {
            if (stream) stream.close();
            stream = null;
            setMode('SYNC · SERVER', false);
            if (!pollTimer) {
                pollTimer = window.setInterval(function () {
                    refreshBackend();
                }, 15000);
            }
        };
    }

    async function trackEvent(name) {
        if (backendMode) {
            try {
                await request('/event', {
                    method: 'POST',
                    body: JSON.stringify({ event: name })
                });
                return;
            } catch (error) { }
        }
        incrementLocal(name);
    }

    async function recordVisit() {
        if (sessionStorage.getItem(VISIT_KEY)) return;
        sessionStorage.setItem(VISIT_KEY, '1');
        if (backendMode) {
            try {
                await request('/visit', { method: 'POST', body: '{}' });
                return;
            } catch (error) { }
        }
        var stats = readLocal();
        stats.total += 1;
        stats.today += 1;
        writeLocal(stats);
    }

    function startLocalMode() {
        backendMode = false;
        setMode('LOCAL · SAVED', false);
        renderStats(readLocal());
        recordVisit();
    }

    async function initAnalytics() {
        try {
            var stats = await request('');
            backendMode = true;
            renderStats(stats);
            setMode('LIVE · SERVER', true);
            await recordVisit();
            if (!disableStream) startStream();
        } catch (error) {
            startLocalMode();
        }
    }

    function openProfileDetail(type) {
        if (!detailOverlay) return;
        var showingContact = type === 'contact';
        detailOverlay.classList.add('active');
        detailOverlay.classList.toggle('analytics-mode', !showingContact);
        if (contactPanel) contactPanel.classList.toggle('active', showingContact);
        if (analyticsPanel) analyticsPanel.classList.toggle('active', !showingContact);
        if (detailTitle) {
            detailTitle.textContent = showingContact
                ? 'contact_view.exe - 联系方式与扫码分享'
                : 'analytics_view.exe - 访问统计';
        }
        if (!showingContact) refreshBackend();
    }

    function closeProfileDetail() {
        if (detailOverlay) detailOverlay.classList.remove('active');
    }

    function openQr() {
        if (!qrModal) return;
        qrModal.classList.add('active');
        trackEvent('wechat');
    }

    function closeQr() {
        if (qrModal) qrModal.classList.remove('active');
    }

    async function copyText(button) {
        var text = button.getAttribute('data-copy');
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            var input = document.createElement('textarea');
            input.value = text;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
        }

        var original = button.textContent;
        button.textContent = 'COPIED';
        window.setTimeout(function () {
            button.textContent = original;
        }, 900);
        trackEvent('copy');
    }

    document.querySelectorAll('.contact-copy-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            copyText(button);
        });
    });

    document.querySelectorAll('.open-qr-trigger').forEach(function (button) {
        button.addEventListener('click', openQr);
    });

    if (contactButton) {
        contactButton.addEventListener('click', function () { openProfileDetail('contact'); });
    }

    if (analyticsButton) {
        analyticsButton.addEventListener('click', function () { openProfileDetail('analytics'); });
    }

    if (detailClose) detailClose.addEventListener('click', closeProfileDetail);
    if (detailOverlay) {
        detailOverlay.addEventListener('click', function (event) {
            if (event.target === detailOverlay) closeProfileDetail();
        });
    }

    if (qrClose) qrClose.addEventListener('click', closeQr);
    if (qrModal) {
        qrModal.addEventListener('click', function (event) {
            if (event.target === qrModal) closeQr();
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeQr();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeProfileDetail();
    });

    if (syncButton) {
        syncButton.addEventListener('click', async function () {
            var ok = await refreshBackend();
            if (!ok) {
                renderStats(readLocal());
                setMode('LOCAL · SAVED', false);
            }
        });
    }

    window.addEventListener('storage', function (event) {
        if (event.key === LOCAL_KEY && !backendMode) renderStats(readLocal());
    });

    window.ykyAnalytics = {
        refresh: refreshBackend,
        event: trackEvent
    };

    window.closeProfileDetail = closeProfileDetail;

    var initialPanel = new URLSearchParams(window.location.search).get('panel');
    if (initialPanel === 'contact' || initialPanel === 'analytics') {
        window.setTimeout(function () { openProfileDetail(initialPanel); }, 0);
    }

    initAnalytics();
})();
