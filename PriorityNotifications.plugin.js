/**
 * @name PriorityNotifications
 * @author axy
 * @authorLink https://github.com/axralty
 * @description Bypass Do Not Disturb for selected priority contacts. Get alerts when they DM you.
 * @version 3.6.3
 * @source https://github.com/axralty/PriorityNotifications
 */

module.exports = (_ => {
    const { Webpack, Patcher, Data, ContextMenu } = BdApi;

    let priorityUsers = Data.load("PriorityNotifications", "priorityUsers") || [];
    let settings = Object.assign({
        soundType:       "synth1",
        volume:          1.0,
        toastPosition:   "bottom-right",
        toastDuration:   6,
        alwaysShowToast: true,
    }, Data.load("PriorityNotifications", "settings") || {});

    if (!["synth1","synth2","synth3"].includes(settings.soundType)) settings.soundType = "synth1";

    const saveUsers    = () => Data.save("PriorityNotifications", "priorityUsers", priorityUsers);
    const saveSettings = () => Data.save("PriorityNotifications", "settings", settings);

    const log  = (...a) => console.log ("%c[PriorityNotif]", "color:#5865f2;font-weight:bold", ...a);
    const warn = (...a) => console.warn("%c[PriorityNotif]", "color:#faa61a;font-weight:bold", ...a);
    const err  = (...a) => console.error("%c[PriorityNotif]", "color:#ed4245;font-weight:bold", ...a);

    let _userStore, _statusStore, _dispatcher, _dispatchHandler, _channelStore, _selectedChannelStore, _navModule;

    const findUserStore   = () => Webpack.getStore("UserStore") || null;
    const findStatusStore = () => Webpack.getStore("PresenceStore") || Webpack.getStore("UserStatusStore") || null;
    const findDispatcher  = () => { try { return Webpack.getStore("MessageStore")?._dispatcher || null; } catch(_) { return null; } };
    const getCS           = () => _channelStore ||= Webpack.getStore("ChannelStore") || null;
    const getSCS          = () => _selectedChannelStore ||= Webpack.getStore("SelectedChannelStore") || null;
    const getNav          = () => _navModule ||= Webpack.getByKeys("transitionTo","replaceWith") || Webpack.getByKeys("transitionTo") || null;

    const isDMChannel = channelId => {
        try { const ch = getCS()?.getChannel?.(channelId); return ch?.type === 1 || ch?.type === 3; }
        catch(_) { return false; }
    };

    const isViewingDMWith = userId => {
        try {
            const curId = getSCS()?.getChannelId?.();
            if (!curId) return false;
            const CS = getCS();
            if (CS?.getDMFromUserId?.(userId) === curId) return true;
            return (CS?.getChannel?.(curId)?.recipients || []).includes(String(userId));
        } catch(_) { return false; }
    };

    const isDiscordFocused  = () => document.visibilityState === "visible" && document.hasFocus();
    const isWindowMinimized = () => document.visibilityState === "hidden";

    const restoreAndNavigate = (userId, channelId) => {
        const minimized = isWindowMinimized();
        try {
            if (minimized) DiscordNative.window.restore();
            DiscordNative.window.focus();
        } catch(e) {
            warn("DiscordNative restore failed:", e.message);
            try { window.focus(); } catch(_) {}
        }
        setTimeout(() => navigateToDM(userId, channelId), minimized ? 450 : 100);
    };

    const navigateToDM = (userId, channelId) => {
        let resolvedChannelId = channelId;
        try { resolvedChannelId ||= getCS()?.getDMFromUserId?.(userId) || null; } catch(_) {}
        if (!resolvedChannelId) { warn("navigateToDM: no channelId resolved"); return; }

        try {
            const Nav = getNav();
            if (Nav?.transitionTo) { Nav.transitionTo(`/channels/@me/${resolvedChannelId}`); return; }
        } catch(e) { warn("transitionTo failed:", e.message); }

        try {
            const link = document.querySelector(`[data-list-item-id="private-channels-${resolvedChannelId}"]`)
                      || document.querySelector(`[href="/channels/@me/${resolvedChannelId}"]`);
            if (link) { link.click(); return; }
        } catch(_) {}

        warn("navigateToDM: all methods failed for channelId=" + resolvedChannelId);
    };

    const makeAudioCtx = () => {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        const ctx    = new Ctx();
        const master = ctx.createGain();
        master.gain.value = Math.max(0, settings.volume ?? 1.0);
        master.connect(ctx.destination);
        const close = () => setTimeout(() => { try { ctx.close(); } catch(_) {} }, 1400);
        return { ctx, master, close };
    };

    const playSynth1 = () => {
        try {
            const ac = makeAudioCtx(); if (!ac) return;
            const { ctx, master, close } = ac;
            const tone = (freq, t0, dur) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(master);
                osc.type = "sine"; osc.frequency.value = freq;
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(0.6, t0 + 0.01);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
                osc.start(t0); osc.stop(t0 + dur + 0.05);
            };
            const now = ctx.currentTime;
            tone(1174, now, 0.18);
            tone(1568, now + 0.11, 0.28);
            close();
        } catch(e) { warn("playSynth1 failed:", e); }
    };

    const playSynth2 = () => {
        try {
            const ac = makeAudioCtx(); if (!ac) return;
            const { ctx, master, close } = ac;
            const chime = (freq, t0) => {
                const osc = ctx.createOscillator(), g = ctx.createGain();
                osc.connect(g); g.connect(master);
                osc.type = "triangle"; osc.frequency.value = freq;
                g.gain.setValueAtTime(0, t0);
                g.gain.linearRampToValueAtTime(0.5, t0 + 0.015);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
                osc.start(t0); osc.stop(t0 + 0.5);
            };
            const now = ctx.currentTime;
            chime(880, now); chime(1100, now + 0.13); chime(1320, now + 0.26);
            close();
        } catch(e) { warn("playSynth2 failed:", e); }
    };

    const playSynth3 = () => {
        try {
            const ac = makeAudioCtx(); if (!ac) return;
            const { ctx, master, close } = ac;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(master);
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.7, now + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now); osc.stop(now + 0.2);

            const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(master);
            osc2.type = "sine"; osc2.frequency.value = 1400;
            gain2.gain.setValueAtTime(0, now + 0.06);
            gain2.gain.linearRampToValueAtTime(0.4, now + 0.07);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc2.start(now + 0.06); osc2.stop(now + 0.25);

            close();
        } catch(e) { warn("playSynth3 failed:", e); }
    };

    const SOUND_FNS = { synth1: playSynth1, synth2: playSynth2, synth3: playSynth3 };
    const playPrioritySound = () => (SOUND_FNS[settings.soundType] || playSynth1)();

    const isDoNotDisturb = () => {
        try {
            const me = _userStore?.getCurrentUser();
            if (!me) return false;
            const status = _statusStore?.getStatus?.(me.id)
                        || _statusStore?.getUserStatus?.(me.id)
                        || _statusStore?.getLocalStatus?.()
                        || Webpack.getStore("UserSettingsProtoStore")?.settings?.status?.status?.value;
            return status === "dnd";
        } catch(_) { return false; }
    };

    const isPriorityUser = userId => priorityUsers.includes(String(userId));

    const TOAST_POSITIONS = {
        "top-left":     "top:24px;left:24px;flex-direction:column;",
        "top-right":    "top:24px;right:24px;flex-direction:column;",
        "bottom-left":  "bottom:24px;left:24px;flex-direction:column-reverse;",
        "bottom-right": "bottom:24px;right:24px;flex-direction:column-reverse;",
    };

    const getContainerCSS = () =>
        "position:fixed;z-index:99999;display:flex;gap:8px;pointer-events:none;width:340px;" +
        (TOAST_POSITIONS[settings.toastPosition] || TOAST_POSITIONS["bottom-right"]);

    let _toastContainer = null;
    const getToastContainer = () => {
        if (_toastContainer && document.body.contains(_toastContainer)) {
            _toastContainer.style.cssText = getContainerCSS();
            return _toastContainer;
        }
        const c = document.createElement("div");
        c.id = "pn-container";
        c.style.cssText = getContainerCSS();
        document.body.appendChild(c);
        return (_toastContainer = c);
    };

    const showInAppToast = (title, body, iconUrl, userId, channelId) => {
        const safe = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "width:340px;pointer-events:all;";

        const avatarHTML = iconUrl
            ? `<img style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" src="${safe(iconUrl)}" onerror="this.style.display='none'">`
            : `<div style="width:36px;height:36px;border-radius:50%;background:#5865f2;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">👤</div>`;

        wrapper.innerHTML = `
        <style>
            @keyframes pnIn  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
            @keyframes pnOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(8px)} }
        </style>
        <div id="pn-card" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#111214;border:1px solid rgba(255,255,255,0.09);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.6);cursor:pointer;font-family:'gg sans','Noto Sans',Arial,sans-serif;animation:pnIn 0.22s cubic-bezier(0.34,1.2,0.64,1) forwards;">
            <div style="flex-shrink:0;position:relative;">
                ${avatarHTML}
                <div style="position:absolute;bottom:-1px;right:-1px;width:11px;height:11px;border-radius:50%;background:#ed4245;border:2px solid #111214;"></div>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:4px;margin-bottom:1px;">
                    <span style="font-size:10px;font-weight:800;color:#ed4245;text-transform:uppercase;letter-spacing:0.06em;">🔔 Priority</span>
                    <span style="font-size:10px;color:#4e5058;">· Direct Message</span>
                </div>
                <div style="font-size:13px;font-weight:700;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(title)}</div>
                <div style="font-size:12px;color:#87898f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe(body)}</div>
            </div>
            <div id="pn-x" title="Dismiss" style="color:#4e5058;font-size:13px;cursor:pointer;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;">✕</div>
        </div>`;

        getToastContainer().appendChild(wrapper);
        const card = wrapper.querySelector("#pn-card");
        const xBtn = wrapper.querySelector("#pn-x");

        const dismiss = () => {
            card.style.animation = "pnOut 0.18s ease forwards";
            setTimeout(() => wrapper.parentNode?.removeChild(wrapper), 200);
        };

        xBtn.addEventListener("click",      e => { e.stopPropagation(); dismiss(); });
        card.addEventListener("click",      e => { if (e.target === xBtn) return; dismiss(); restoreAndNavigate(userId, channelId); });
        card.addEventListener("mouseenter", () => { card.style.background="#1a1b1e"; card.style.borderColor="rgba(255,255,255,0.14)"; });
        card.addEventListener("mouseleave", () => { card.style.background="#111214"; card.style.borderColor="rgba(255,255,255,0.09)"; });
        xBtn.addEventListener("mouseenter", () => { xBtn.style.color="#f2f3f5"; xBtn.style.background="rgba(255,255,255,0.09)"; });
        xBtn.addEventListener("mouseleave", () => { xBtn.style.color="#4e5058"; xBtn.style.background="transparent"; });

        setTimeout(dismiss, Math.max(1, Math.min(15, settings.toastDuration ?? 6)) * 1000);
    };

    const showNativeNotification = (title, body, iconUrl, userId, channelId) => {
        if (Notification.permission !== "granted") return;
        try {
            const n = new Notification(`🔔 Priority: ${title}`, {
                body, icon: iconUrl || undefined,
                silent: true, requireInteraction: false, tag: `pn-${userId}`,
            });
            n.onclick = () => { n.close(); restoreAndNavigate(userId, channelId); };
            setTimeout(() => { try { n.close(); } catch(_) {} },
                (Math.max(1, Math.min(15, settings.toastDuration ?? 6)) + 2) * 1000);
        } catch(e) { warn("Native notification failed:", e.message); }
    };

    const handleMessage = message => {
        if (!message?.author) return;
        const authorId   = String(message.author.id);
        const me = _userStore?.getCurrentUser();
        if (!me || authorId === String(me.id)) return;
        if (!isPriorityUser(authorId)) return;

        const channelId = String(message.channel_id || "");
        if (!isDMChannel(channelId)) return;
        if (!isDoNotDisturb()) return;

        const authorName = message.author.global_name || message.author.username || authorId;
        const content    = message.content
            ? (message.content.length > 80 ? message.content.slice(0, 77) + "…" : message.content)
            : (message.attachments?.length ? "[attachment]" : "[message]");
        const iconUrl = message.author.avatar
            ? `https://cdn.discordapp.com/avatars/${authorId}/${message.author.avatar}.png`
            : null;

        const focused        = isDiscordFocused();
        const minimized      = isWindowMinimized();
        const viewingDM      = isViewingDMWith(authorId);
        const discordInFront = focused && !minimized;

        log(`📨 Priority DM | ${authorName} | focused=${focused} | minimized=${minimized} | viewingDM=${viewingDM}`);

        playPrioritySound();

        if (discordInFront) {
            if (!viewingDM || settings.alwaysShowToast)
                showInAppToast(authorName, content, iconUrl, authorId, channelId);
        } else {
            showNativeNotification(authorName, content, iconUrl, authorId, channelId);
        }
    };

    const applyPatches = () => {
        _dispatcher = findDispatcher();
        if (!_dispatcher) { warn("Dispatcher not found"); return; }
        _dispatchHandler = e => { try { handleMessage(e?.message || e); } catch(ex) { err(ex); } };
        _dispatcher.subscribe("MESSAGE_CREATE", _dispatchHandler);
        log("✅ Subscribed to MESSAGE_CREATE");
    };

    let _ctxUnpatch = null;
    const applyContextMenu = () => {
        const patch = id => ContextMenu.patch(id, (menu, props) => {
            const userId = String(props?.user?.id || props?.channel?.recipients?.[0] || "");
            if (!userId) return;
            const already = isPriorityUser(userId);
            menu.props.children.push(
                ContextMenu.buildItem({ type: "separator" }),
                ContextMenu.buildItem({
                    type: "toggle", label: "🔔 Priority Notifications", active: already,
                    action: () => {
                        if (already) priorityUsers = priorityUsers.filter(i => i !== userId);
                        else priorityUsers.push(userId);
                        saveUsers();
                    }
                })
            );
        });
        const p1 = patch("user-context"), p2 = patch("dm-context"), p3 = patch("gdm-context");
        _ctxUnpatch = () => { try{p1();}catch(_){} try{p2();}catch(_){} try{p3();}catch(_){} };
        log("✅ Context menus patched");
    };

    const registerDebug = () => {
        window.PNDebug = () => {
            let navTest = "(no priority users to test)";
            if (priorityUsers[0]) {
                try {
                    const dmId = getCS()?.getDMFromUserId?.(priorityUsers[0]);
                    navTest = dmId ? `DM channel resolved: ${dmId}` : "DM channel not found";
                } catch(e) { navTest = "error: " + e.message; }
            }
            const report = {
                "Sound type":       settings.soundType,
                "Volume":           (settings.volume * 100).toFixed(0) + "%",
                "Toast duration":   (settings.toastDuration ?? 6) + "s",
                "Settings":         JSON.stringify(settings, null, 2),
                "Priority users":   priorityUsers.join(", ") || "(none)",
                "UserStore":        !!_userStore,
                "StatusStore":      !!_statusStore,
                "Dispatcher":       !!_dispatcher,
                "Current user":     (() => { try { const u=_userStore?.getCurrentUser(); return u?`${u.username} (${u.id})`:"none"; } catch(_){return "error";} })(),
                "DND active now":   isDoNotDisturb(),
                "Discord focused":  isDiscordFocused(),
                "Window minimized": isWindowMinimized(),
                "Discord in front": isDiscordFocused() && !isWindowMinimized(),
                "Nav test":         navTest,
            };
            console.group("%c[PriorityNotif] DEBUG REPORT", "color:#5865f2;font-size:14px;font-weight:bold");
            for (const [k, v] of Object.entries(report))
                console.log(`%c${k}:%c ${v}`, "color:#87898f;font-weight:700", "color:#dcddde");
            console.groupEnd();
            console.log("%cTesting all 3 sounds (1.2s apart):", "color:#43b581;font-weight:bold");
            playSynth1(); setTimeout(playSynth2, 1200); setTimeout(playSynth3, 2400);
            return report;
        };
        log("Debug ready: run  window.PNDebug()  in DevTools console");
    };

    const showHelpModal = () => {
        document.getElementById("pn-help-modal")?.remove();
        const overlay = mkOverlay("pn-help-modal");
        const modal   = document.createElement("div");
        modal.style.cssText = "background:#313338;border-radius:12px;width:460px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.85);overflow:hidden;";

        const header = document.createElement("div");
        header.style.cssText = "padding:20px 20px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;";
        header.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;background:#3ba55d;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">💡</div>
            <div>
                <div style="font-size:16px;font-weight:800;color:#f2f3f5;">How Priority Notifications Works</div>
                <div style="font-size:12px;color:#87898f;">Everything you need to know</div>
            </div>`;
        modal.appendChild(header);

        const bodyEl = document.createElement("div");
        bodyEl.style.cssText = "flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px;";

        [
            { icon:"🎯", title:"What does this plugin do?",
              text:"When you're in <b style='color:#f2f3f5'>Do Not Disturb</b> mode, Discord silences all notifications. This plugin bypasses that — if someone on your Priority List sends you a Direct Message, you get a sound alert and a popup regardless of your status." },
            { icon:"➕", title:"How to add a Priority Contact",
              text:"Two ways:<br>① <b style='color:#f2f3f5'>Right-click</b> any user or DM → toggle <b style='color:#f2f3f5'>🔔 Priority Notifications</b><br>② Paste their <b style='color:#f2f3f5'>User ID</b> into the Priority Contacts box in settings and click Add." },
            { icon:"🔑", title:"Finding a User ID",
              text:"Go to <b style='color:#f2f3f5'>Discord Settings → Advanced</b> and enable <b style='color:#f2f3f5'>Developer Mode</b>. Then right-click any user and choose <b style='color:#f2f3f5'>Copy User ID</b>." },
            { icon:"🔔", title:"When does it fire?",
              text:"All 3 conditions must be true:<br>① Your status is <b style='color:#ed4245'>Do Not Disturb</b><br>② The sender is on your <b style='color:#f2f3f5'>Priority List</b><br>③ The message is a <b style='color:#f2f3f5'>Direct Message</b> (not a server channel)" },
            { icon:"📣", title:"In-app toast vs Desktop notification",
              text:"<b style='color:#f2f3f5'>Discord in focus</b> → in-app toast only<br><b style='color:#f2f3f5'>Discord not in focus</b> → desktop notification only<br><br>Enable <b style='color:#f2f3f5'>Show toast when viewing DM</b> to also see the in-app toast when you're already in that exact DM." },
            { icon:"🖥️", title:"Clicking a notification",
              text:"Both the in-app toast and the desktop notification will <b style='color:#f2f3f5'>restore Discord and navigate directly to the DM</b> — even if you were in a server channel." },
            { icon:"⏱️", title:"Toast duration",
              text:"Control how long the in-app toast stays on screen — from <b style='color:#f2f3f5'>1 to 15 seconds</b>." },
            { icon:"🎵", title:"Sounds",
              text:"Three built-in alert sounds:<br>① <b style='color:#f2f3f5'>Synth Ding</b> — classic two-tone ding<br>② <b style='color:#f2f3f5'>Chime</b> — soft ascending triple chime<br>③ <b style='color:#f2f3f5'>Blip</b> — punchy electronic alert<br>Click the <b style='color:#f2f3f5'>▶</b> button on each to preview." },
            { icon:"🔊", title:"Volume",
              text:"0–100% is normal. <b style='color:#faa61a'>Above 100%</b> uses Web Audio amplification — may distort at extreme values." },
            { icon:"🛠️", title:"Troubleshooting / Debug",
              text:"Open DevTools with <b style='color:#f2f3f5'>Ctrl+Shift+I</b>, Console tab, run:<br><code style='background:#1e1f22;padding:4px 8px;border-radius:4px;font-size:12px;color:#43b581;display:inline-block;margin-top:4px;'>window.PNDebug()</code><br>This plays all 3 sounds and prints full state info." },
        ].forEach(s => {
            const card = document.createElement("div");
            card.style.cssText = "background:#2b2d31;border-radius:8px;padding:12px 14px;";
            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="font-size:16px;">${s.icon}</span>
                    <span style="font-size:13px;font-weight:800;color:#f2f3f5;">${s.title}</span>
                </div>
                <div style="font-size:12px;color:#b5bac1;line-height:1.55;">${s.text}</div>`;
            bodyEl.appendChild(card);
        });
        modal.appendChild(bodyEl);

        const footer = document.createElement("div");
        footer.style.cssText = "padding:12px 18px;background:#2b2d31;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:flex-end;";
        footer.appendChild(mkBtn("Got it! ✓", "#3ba55d", () => overlay.remove(), "padding:8px 22px;border-radius:6px;border:none;font-size:13px;cursor:pointer;font-weight:800;color:#fff;"));
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    };

    const mkOverlay = id => {
        const el = document.createElement("div");
        el.id = id;
        el.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;font-family:'gg sans','Noto Sans',Arial,sans-serif;";
        el.addEventListener("click", e => { if (e.target === el) el.remove(); });
        return el;
    };

    const mkBtn = (label, bg, onClick, extraCSS) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = (extraCSS || "padding:7px 14px;border-radius:6px;border:none;font-size:12px;cursor:pointer;font-weight:800;color:#fff;") + `background:${bg};`;
        b.onclick = onClick;
        return b;
    };

    const getSettingsPanel = () => {
        const el = document.createElement("div");
        el.style.cssText = "font-family:'gg sans','Noto Sans',Whitney,sans-serif;color:#dcddde;padding:16px;max-width:520px;";

        const section = title => {
            const wrap = document.createElement("div");
            wrap.style.cssText = "background:#2b2d31;border-radius:8px;padding:14px;margin-bottom:10px;";
            const lbl = document.createElement("div");
            lbl.style.cssText = "font-size:10px;font-weight:800;color:#87898f;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;";
            lbl.textContent = title;
            wrap.appendChild(lbl);
            return wrap;
        };

        const SOUNDS = [
            { value:"synth1", label:"🔔 Synth Ding", desc:"Classic two-tone ding",       play: playSynth1 },
            { value:"synth2", label:"🎵 Chime",      desc:"Soft ascending triple chime", play: playSynth2 },
            { value:"synth3", label:"⚡ Blip",        desc:"Punchy electronic alert",     play: playSynth3 },
        ];

        const render = () => {
            el.innerHTML = "";

            const topRow = document.createElement("div");
            topRow.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:12px;";
            const titleBlock = document.createElement("div");
            titleBlock.innerHTML = `
                <div style="font-size:18px;font-weight:800;color:#f2f3f5;margin-bottom:3px;">🔔 Priority Notifications</div>
                <div style="font-size:13px;color:#87898f;">Bypass DND for contacts that matter.</div>`;
            topRow.appendChild(titleBlock);
            topRow.appendChild(mkBtn("💡 How it works", "#3ba55d", () => showHelpModal(),
                "padding:7px 14px;border-radius:6px;border:none;font-size:12px;cursor:pointer;font-weight:800;color:#fff;white-space:nowrap;flex-shrink:0;margin-top:2px;"));
            el.appendChild(topRow);

            const infoCard = document.createElement("div");
            infoCard.style.cssText = "background:#1e1f22;border:1px solid rgba(88,101,242,0.3);border-radius:8px;padding:12px 14px;margin-bottom:10px;font-size:12px;color:#87898f;line-height:1.6;";
            infoCard.innerHTML = `
                <div style="font-size:11px;font-weight:800;color:#5865f2;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">How Alerts Work</div>
                <div>🖥️ <b style="color:#f2f3f5">Discord in focus</b> → in-app toast only</div>
                <div>📵 <b style="color:#f2f3f5">Discord not in focus</b> → desktop notification only</div>`;
            el.appendChild(infoCard);

            const ss = section("Notification Sound");
            SOUNDS.forEach(({ value, label, desc, play }) => {
                const active = settings.soundType === value;
                const row = document.createElement("div");
                row.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;margin-bottom:6px;cursor:pointer;background:${active?"rgba(88,101,242,0.15)":"#1e1f22"};border:2px solid ${active?"#5865f2":"transparent"};transition:all 0.1s;`;
                row.innerHTML = `
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#f2f3f5;">${label}${active?' <span style="font-size:10px;background:#5865f2;color:#fff;padding:1px 7px;border-radius:10px;font-weight:800;vertical-align:middle;">ACTIVE</span>':""}</div>
                        <div style="font-size:11px;color:#87898f;margin-top:1px;">${desc}</div>
                    </div>`;
                row.appendChild(mkBtn("▶", "#3ba55d", e => { e.stopPropagation(); play(); },
                    "padding:5px 10px;border-radius:5px;border:none;font-size:13px;cursor:pointer;font-weight:800;color:#fff;flex-shrink:0;"));
                row.addEventListener("click", () => { settings.soundType = value; saveSettings(); render(); });
                row.addEventListener("mouseenter", () => { if (!active) row.style.background="#2b2d31"; });
                row.addEventListener("mouseleave", () => { if (!active) row.style.background="#1e1f22"; });
                ss.appendChild(row);
            });

            const volPct = Math.round((settings.volume ?? 1.0) * 100);
            const volLabel = document.createElement("div");
            volLabel.style.cssText = `font-size:12px;color:${volPct>100?"#faa61a":"#87898f"};font-weight:700;margin-top:10px;margin-bottom:6px;`;
            volLabel.textContent = `Volume: ${volPct}%`;
            const slider = document.createElement("input");
            Object.assign(slider, { type:"range", min:"0", max:"300", step:"5", value:volPct });
            slider.style.cssText = "width:100%;accent-color:#5865f2;cursor:pointer;";
            slider.oninput = () => {
                settings.volume = Number(slider.value) / 100;
                volLabel.textContent = `Volume: ${slider.value}%`;
                volLabel.style.color = Number(slider.value) > 100 ? "#faa61a" : "#87898f";
                saveSettings();
            };
            ss.appendChild(volLabel);
            ss.appendChild(slider);
            if (volPct > 100) {
                const bw = document.createElement("div");
                bw.style.cssText = "font-size:10px;color:#faa61a;margin-top:4px;";
                bw.textContent = "Above 100% uses Web Audio amplification — may distort at extreme values.";
                ss.appendChild(bw);
            }
            el.appendChild(ss);

            const ps = section("Toast Position");
            const posGrid = document.createElement("div");
            posGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;";
            [
                { value:"top-left",     label:"↖ Top Left" },
                { value:"top-right",    label:"↗ Top Right" },
                { value:"bottom-left",  label:"↙ Bottom Left" },
                { value:"bottom-right", label:"↘ Bottom Right" },
            ].forEach(({ value, label }) => {
                const active = (settings.toastPosition || "bottom-right") === value;
                const btn = document.createElement("button");
                btn.textContent = label;
                btn.style.cssText = `padding:8px;border-radius:5px;border:2px solid ${active?"#5865f2":"rgba(255,255,255,0.08)"};background:${active?"#5865f2":"transparent"};color:${active?"#fff":"#87898f"};font-size:12px;cursor:pointer;font-weight:800;`;
                btn.onclick = () => { settings.toastPosition = value; saveSettings(); if (_toastContainer) _toastContainer.style.cssText = getContainerCSS(); render(); };
                posGrid.appendChild(btn);
            });
            ps.appendChild(posGrid);
            el.appendChild(ps);

            const ds = section("Toast Duration");
            const durVal = Math.max(1, Math.min(15, settings.toastDuration ?? 6));
            const durLabel = document.createElement("div");
            durLabel.style.cssText = "font-size:12px;color:#87898f;font-weight:700;margin-bottom:6px;";
            durLabel.textContent = `Duration: ${durVal}s`;
            const durSlider = document.createElement("input");
            Object.assign(durSlider, { type:"range", min:"1", max:"15", step:"1", value:durVal });
            durSlider.style.cssText = "width:100%;accent-color:#5865f2;cursor:pointer;";
            durSlider.oninput = () => {
                settings.toastDuration = Number(durSlider.value);
                durLabel.textContent = `Duration: ${durSlider.value}s`;
                saveSettings();
            };
            const durNote = document.createElement("div");
            durNote.style.cssText = "font-size:11px;color:#4e5058;margin-top:6px;";
            durNote.textContent = "Applies to both in-app toasts and desktop notifications.";
            ds.appendChild(durLabel); ds.appendChild(durSlider); ds.appendChild(durNote);
            el.appendChild(ds);

            const bs = section("Behavior");
            const bRow = document.createElement("div");
            bRow.style.cssText = "display:flex;align-items:center;gap:12px;padding:9px 0;";
            const txt = document.createElement("div"); txt.style.cssText = "flex:1;";
            txt.innerHTML = `<div style="font-size:13px;font-weight:600;color:#f2f3f5;">Show toast when viewing DM</div><div style="font-size:11px;color:#87898f;">Show popup even when Discord is focused and you're already reading that DM</div>`;
            const on = settings.alwaysShowToast !== false;
            const tog = document.createElement("div");
            tog.style.cssText = `width:40px;height:22px;border-radius:11px;background:${on?"#5865f2":"#4e5058"};cursor:pointer;position:relative;transition:background 0.15s;flex-shrink:0;`;
            const knob = document.createElement("div");
            knob.style.cssText = `position:absolute;top:3px;left:${on?"21px":"3px"};width:16px;height:16px;border-radius:50%;background:#fff;transition:left 0.15s;`;
            tog.appendChild(knob);
            tog.onclick = () => { settings.alwaysShowToast = !on; saveSettings(); render(); };
            bRow.appendChild(txt); bRow.appendChild(tog);
            bs.appendChild(bRow);
            el.appendChild(bs);

            const btnRow = document.createElement("div");
            btnRow.style.cssText = "display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;";
            const getTestUser = () => {
                const id = priorityUsers[0];
                if (!id) { alert("Add at least one user to your priority list first!"); return null; }
                const u = _userStore?.getUser(id);
                return { id, name: u?.global_name||u?.username||"Test User", icon: u?.avatar?`https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png`:null };
            };
            btnRow.appendChild(mkBtn("🧪 Test Toast", "#5865f2", () => {
                const u = getTestUser(); if (!u) return;
                playPrioritySound();
                showInAppToast(u.name, "Click me to open the Direct Message! (test)", u.icon, u.id, null);
            }));
            btnRow.appendChild(mkBtn("🔊 Test Sound", "#3ba55d", () => playPrioritySound()));
            el.appendChild(btnRow);

            const cLbl = document.createElement("div");
            cLbl.style.cssText = "font-size:10px;font-weight:800;color:#87898f;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;";
            cLbl.textContent = "Priority Contacts";
            el.appendChild(cLbl);

            const addRow = document.createElement("div");
            addRow.style.cssText = "display:flex;gap:8px;margin-bottom:12px;";
            const input = document.createElement("input");
            input.placeholder = "Paste a User ID";
            input.style.cssText = "flex:1;padding:8px 12px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:#1e1f22;color:#f2f3f5;font-size:13px;outline:none;";
            input.addEventListener("focus", () => input.style.borderColor="#5865f2");
            input.addEventListener("blur",  () => input.style.borderColor="rgba(255,255,255,0.08)");
            const doAdd = () => {
                const id = input.value.trim().replace(/\D/g, "");
                if (!id) return;
                if (priorityUsers.includes(id)) {
                    input.style.borderColor="#ed4245";
                    setTimeout(() => input.style.borderColor="rgba(255,255,255,0.08)", 1500);
                    return;
                }
                priorityUsers.push(id); saveUsers(); input.value=""; render();
            };
            const addBtn = mkBtn("Add", "#5865f2", doAdd, "padding:8px 18px;border-radius:5px;border:none;font-size:13px;cursor:pointer;font-weight:800;color:#fff;");
            input.addEventListener("keydown", e => { if (e.key==="Enter") doAdd(); });
            addRow.appendChild(input); addRow.appendChild(addBtn);
            el.appendChild(addRow);

            if (!priorityUsers.length) {
                const empty = document.createElement("div");
                empty.style.cssText = "text-align:center;color:#4e5058;padding:20px 0;font-size:14px;";
                empty.textContent = "No priority contacts yet.";
                el.appendChild(empty);
            } else {
                priorityUsers.forEach(uid => {
                    const user = _userStore?.getUser(uid);
                    const card = document.createElement("div");
                    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px 12px;background:#2b2d31;border-radius:8px;margin-bottom:6px;";
                    const av = document.createElement("div");
                    av.style.cssText = "width:36px;height:36px;border-radius:50%;flex-shrink:0;overflow:hidden;background:#5865f2;display:flex;align-items:center;justify-content:center;font-size:17px;";
                    if (user?.avatar) {
                        const img = document.createElement("img");
                        img.src = `https://cdn.discordapp.com/avatars/${uid}/${user.avatar}.png?size=40`;
                        img.style.cssText = "width:100%;height:100%;object-fit:cover;";
                        av.appendChild(img);
                    } else av.textContent = "👤";
                    card.appendChild(av);
                    const info = document.createElement("div"); info.style.cssText="flex:1;min-width:0;";
                    const nm = document.createElement("div");
                    nm.style.cssText = "font-weight:700;font-size:14px;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
                    nm.textContent = user ? (user.global_name||user.username) : `Unknown (${uid})`;
                    const idEl = document.createElement("div");
                    idEl.style.cssText = "font-size:11px;color:#4e5058;font-family:monospace;";
                    idEl.textContent = uid;
                    info.appendChild(nm); info.appendChild(idEl); card.appendChild(info);
                    card.appendChild(mkBtn("Remove", "#ed4245",
                        () => { priorityUsers=priorityUsers.filter(i=>i!==uid); saveUsers(); render(); },
                        "padding:5px 12px;border-radius:5px;border:none;font-size:12px;cursor:pointer;font-weight:800;color:#fff;flex-shrink:0;"));
                    el.appendChild(card);
                });
            }
        };

        render();
        return el;
    };

    return class PriorityNotifications {
        start() {
            if (Notification.permission === "default") Notification.requestPermission();
            _userStore   = findUserStore();
            _statusStore = findStatusStore();
            registerDebug();
            log("v3.6.3 started | users:", priorityUsers, "| settings:", JSON.stringify(settings));
            log("▶ Run  window.PNDebug()  in DevTools console for full diagnostics");
            applyPatches();
            applyContextMenu();
        }
        stop() {
            Patcher.unpatchAll("PriorityNotifications");
            try { if (_dispatcher && _dispatchHandler) _dispatcher.unsubscribe("MESSAGE_CREATE", _dispatchHandler); } catch(_) {}
            try { _ctxUnpatch?.(); } catch(_) {}
            if (_toastContainer && document.body.contains(_toastContainer)) {
                document.body.removeChild(_toastContainer);
                _toastContainer = null;
            }
            document.getElementById("pn-help-modal")?.remove();
            try { delete window.PNDebug; } catch(_) {}
            _channelStore = _selectedChannelStore = _navModule = null;
            log("Stopped");
        }
        getSettingsPanel() { return getSettingsPanel(); }
    };
})();