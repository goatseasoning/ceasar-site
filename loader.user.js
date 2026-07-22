// ==UserScript==
// @name         CEASAR
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  UI In-Game (errors only) & Lobby, 8H Cache, Manual Refresh
// @match        *://*.travian.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE = 'https://ceasar-api.onrender.com/api';

    // CACHE ULTRA-LONGA:
    const CACHE_ACTIVE_MS = 8 * 60 * 60 * 1000; // 8 Horas se estiver Ativo (Poupança Extrema)
    const CACHE_INACTIVE_MS = 15 * 1000;        // 15 Segundos se estiver Expirado

    const isLobby = window.location.hostname.includes('lobby');

    // --- 0. FUNÇÃO PARA FORMATAR A DATA ---
    function formatarData(isoString) {
        if (!isoString) return 'Unknown';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

        // --- 1. UI DO LOADER (DESIGN PREMIUM ROMANO) ---
    function desenharPainelLoader(lobbyId, estado, mensagemExtra = "") {

        if (!isLobby && (estado === 'active' || estado === 'loading')) {
            let box = document.getElementById('ceasar-loader-panel');
            if (box) box.remove();
            return;
        }

        let box = document.getElementById('ceasar-loader-panel');
        if (!box) {
            box = document.createElement('div');
            box.id = 'ceasar-loader-panel';
                       // CSS Premium blindado contra as páginas do Travian
            box.style.cssText = `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                all: initial !important; /* Reseta todo o CSS que o Travian tenta aplicar */
                position: fixed !important;
                top: 90px !important;
                right: 15px !important;
                padding: 16px !important;
                background: linear-gradient(145deg, rgba(20, 25, 35, 0.95), rgba(10, 15, 25, 0.98)) !important;
                backdrop-filter: blur(8px) !important;
                border-radius: 12px !important;
                z-index: 999999 !important;
                font-family: 'Inter', sans-serif !important;
                color: #e2e8f0 !important;
                width: 240px !important;
                min-width: 240px !important;
                max-width: 240px !important;
                box-sizing: border-box !important;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 1px 1px rgba(212, 175, 55, 0.2) !important;
                border-top: 2px solid rgba(212, 175, 55, 0.5) !important;
                margin: 0 !important;
                line-height: 1.5 !important;
                display: block !important;
                height: auto !important; /* Garante que não é esticado artificialmente */
                min-height: max-content !important;
            `;

            if (document.body) document.body.appendChild(box);
            else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
        }

        let corEstado = '#D4AF37'; // Dourado a carregar
        let textoEstado = 'Checking...';
        let htmlExtra = '';

        const validade = GM_getValue('ceasar_expires_at', null);
        const textoValidade = validade ? formatarData(validade) : '...';

                // Botão de Refresh alinhado à direita e sem margens gigantes
               // Refresh apenas como texto clicável, alinhado à direita
        const refreshButtonHtml = `
            <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 10px; padding-top: 8px; display: flex; justify-content: flex-end;">
                <span id="ceasar-refresh-btn" style="
                    color: #94a3b8 !important;
                    cursor: pointer !important;
                    font-size: 11px !important;
                    font-weight: 500 !important;
                    transition: all 0.2s !important;
                    display: inline-flex !important;
                    align-items: center !important;
                "><i class="fa-solid fa-rotate-right" style="margin-right: 4px;"></i> Force Refresh</span>
            </div>`;

        if (estado === 'active') {
            corEstado = '#10b981';
            textoEstado = 'Licence Valid';
            htmlExtra = `
                <div style="font-size: 12px; margin-top: 10px; color:#94a3b8; display: flex; justify-content: space-between;">
                    <span style="color:#94a3b8;">Valid until:</span>
                    <span style="color:#94a3b8; font-weight: 600;">${textoValidade}</span>
                </div>
                ${refreshButtonHtml}`;
                } else if (estado === 'expired') {
            corEstado = '#ef4444';
            textoEstado = 'Licence Expired';
            htmlExtra = `
                <div style="font-size: 12px; margin-top: 10px; margin-bottom: 12px; color:#94a3b8; display: flex; justify-content: space-between;">
                    <span>Expired on:</span>
                    <span style="color:#ef4444; font-weight: 600;">${textoValidade}</span>
                </div>
                <a href="https://ceasarbot.com/checkout.html?user=${encodeURIComponent(lobbyId)}" target="_blank" style="
                    display: block !important;
                    background: linear-gradient(to right, #721422, #4A0D16) !important;
                    color: white !important;
                    text-align: center !important;
                    text-decoration: none !important;
                    padding: 6px 0px !important;
                    border-radius: 6px !important;
                    font-weight: bold !important;
                    font-size: 13px !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
                    margin-bottom: 10px !important;
                    line-height: 16px !important;
                    height: auto !important;
                ">Renew</a>
                ${refreshButtonHtml}`;
        } else if (estado === 'banned') {
            corEstado = '#ef4444';
            textoEstado = 'Account Blocked';
            htmlExtra = `<div style="font-size:11px; margin-top:10px; color:#ef4444; background: rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 4px;">Your access was revoked by the Admin.</div>`;
        } else if (estado === 'error') {
            corEstado = '#ef4444';
            textoEstado = 'Connection Error';
            htmlExtra = `<div style="font-size:11px; margin-top:10px; margin-bottom: 10px; color:#94a3b8;">${mensagemExtra}</div>${refreshButtonHtml}`;
        }

        box.innerHTML = `
            <div style="font-size: 16px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 10px; display:flex; justify-content: space-between; align-items: center; color: #f8fafc; letter-spacing: 0.5px;">
                <span><span style="color: #D4AF37;">CEASAR</span> BOT</span>
                <span style="height: 8px; width: 8px; background-color: ${corEstado}; border-radius: 50%; box-shadow: 0 0 5px ${corEstado};"></span>
            </div>
            <div style="font-size: 12px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span style="color:#94a3b8;">Lobby:</span>
                <span style="color:#e2e8f0; font-weight: 600;">${lobbyId}</span>
            </div>
            <div style="font-size: 12px; display: flex; justify-content: space-between;">
                <span style="color:#94a3b8;">Status:</span>
                <span style="color:${corEstado}; font-weight:bold;">${textoEstado}</span>
            </div>
            ${htmlExtra}
        `;

        // Adicionar o Event Listener ao botão de refresh
        const refreshBtn = document.getElementById('ceasar-refresh-btn');
        if (refreshBtn) {
            // Hover effect via JS para não injetar estilos globais sujos
            refreshBtn.addEventListener('mouseenter', () => {
                refreshBtn.style.color = '#D4AF37';
                refreshBtn.style.textShadow = '0 0 1px rgba(212, 175, 55, 0.4)';
            });
            refreshBtn.addEventListener('mouseleave', () => {
                refreshBtn.style.color = '#94a3b8';
                refreshBtn.style.textShadow = 'none';
            });
            refreshBtn.addEventListener('click', () => {
                refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 4px;"></i> Verifying...';
                GM_setValue('ceasar_last_check_time', 0);
                setTimeout(inicializar, 200);
            });
        }
    }

    // --- 2. GESTÃO DO LOBBY ID ---
    function getLobbyUsername() {
        if (isLobby) {
            const accountMenuSpan = document.querySelector('a.openCloseAccountMenu span');
            if (accountMenuSpan && accountMenuSpan.innerText.trim() !== '') {
                const id = accountMenuSpan.innerText.trim();
                GM_setValue('ceasar_lobby_id', id);
                return id;
            }
        }
        return GM_getValue('ceasar_lobby_id') || null;
    }

    // --- 3. EXECUTAR O BOT IMEDIATAMENTE ---
    function executarBotDaMemoria(lobbyId) {
        const codigoGuardado = GM_getValue('ceasar_bot_code');
        if (codigoGuardado) {
            try {
                new Function(codigoGuardado)();
            } catch (e) {
                console.error("[Ceasar Bot] Error running cached code:", e);
                pedirCodigoAoServidor(lobbyId, true);
            }
        } else {
            pedirCodigoAoServidor(lobbyId, true);
        }
    }

    // --- 4. ATUALIZAR O CÓDIGO EM BACKGROUND ---
    function pedirCodigoAoServidor(lobbyId, executarLogo = false) {
        GM_xmlhttpRequest({
            method: "POST",
            url: API_BASE + '/bot-core',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ lobbyId: lobbyId }),
            onload: function(res) {
                if (res.status === 200) {
                    GM_setValue('ceasar_bot_code', res.responseText);
                    GM_setValue('ceasar_last_code_update', Date.now()); // Marca que atualizou o código agora
                    if (executarLogo) {
                        try { new Function(res.responseText)(); } catch (e) {}
                    }
                }
            }
        });
    }

    // --- 5. LÓGICA CENTRAL ---
    async function inicializar() {
        const lobbyId = getLobbyUsername();

        if (!lobbyId) {
            if (isLobby && !window.location.href.includes('/login')) setTimeout(inicializar, 200);
            return;
        }

        const ultimaValidacao = GM_getValue('ceasar_last_check_time', 0);
        const tempoPassado = Date.now() - ultimaValidacao;
        const licencaEstaAtivaNaCache = GM_getValue('ceasar_is_active', false);

        const limiteCache = licencaEstaAtivaNaCache ? CACHE_ACTIVE_MS : CACHE_INACTIVE_MS;

        desenharPainelLoader(lobbyId, 'loading');

        // CACHE AINDA VÁLIDA
        if (tempoPassado < limiteCache) {
            if (licencaEstaAtivaNaCache) {
                desenharPainelLoader(lobbyId, 'active');
                if (!isLobby) executarBotDaMemoria(lobbyId);

                // Só atualiza o código do bot se passaram 2 horas desde o último download
                if (Date.now() - GM_getValue('ceasar_last_code_update', 0) > 2 * 60 * 60 * 1000) {
                    pedirCodigoAoServidor(lobbyId);
                }
            } else {
                desenharPainelLoader(lobbyId, GM_getValue('ceasar_last_error_state', 'expired'));
            }
            return;
        }

        // VALIDAR COM O SERVIDOR
        try {
            const response = await fetch(API_BASE + '/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId: lobbyId }) });
            const data = await response.json();

            GM_setValue('ceasar_last_check_time', Date.now());

            if (data.expires_at) {
                GM_setValue('ceasar_expires_at', data.expires_at);
            }

            if (data.status === 'active') {
                GM_setValue('ceasar_is_active', true);
                desenharPainelLoader(lobbyId, 'active');

                if (!isLobby) pedirCodigoAoServidor(lobbyId, true);
                else pedirCodigoAoServidor(lobbyId);

            } else if (data.status === 'banned') {
                GM_setValue('ceasar_is_active', false);
                GM_setValue('ceasar_bot_code', '');
                GM_setValue('ceasar_last_error_state', 'banned');
                desenharPainelLoader(lobbyId, 'banned');
            } else {
                GM_setValue('ceasar_is_active', false);
                GM_setValue('ceasar_bot_code', '');
                GM_setValue('ceasar_last_error_state', 'expired');
                desenharPainelLoader(lobbyId, 'expired');
            }
        } catch (error) {
            if (licencaEstaAtivaNaCache) {
                desenharPainelLoader(lobbyId, 'active', '(Offline Mode)');
                if (!isLobby) executarBotDaMemoria(lobbyId);
            } else {
                desenharPainelLoader(lobbyId, 'error', 'Server Offline');
            }
        }
    }

    // Inicialização da Script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }

})();
