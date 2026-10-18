// Focus sounds generated with the Web Audio API — no audio files to host or license.
// An AudioContext can only start after a user gesture, so everything is created lazily.

let ctx = null;
let master = null;
let current = null; // { id, nodes: [] }

const getCtx = () => {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
};

const noiseBuffer = (ac, color) => {
    const length = ac.sampleRate * 4;
    const buffer = ac.createBuffer(2, length, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let last = 0;
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            if (color === 'brown') {
                last = (last + 0.02 * white) / 1.02;
                data[i] = last * 3.5;
            } else {
                // Paul Kellet's pink noise approximation
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.969 * b2 + white * 0.153852;
                b3 = 0.8665 * b3 + white * 0.3104856;
                b4 = 0.55 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.016898;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        }
    }
    return buffer;
};

const loop = (ac, buffer) => {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
};

const builders = {
    // Steady rain: pink noise, band-limited, with a slow swell.
    rain(ac, out) {
        const src = loop(ac, noiseBuffer(ac, 'pink'));
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
        const swell = ac.createGain(); swell.gain.value = 0.8;
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.08;
        const lfoGain = ac.createGain(); lfoGain.gain.value = 0.18;
        lfo.connect(lfoGain).connect(swell.gain);
        src.connect(hp).connect(lp).connect(swell).connect(out);
        src.start(); lfo.start();
        return [src, lfo];
    },
    // Deep brown noise: the classic "focus" sound.
    brown(ac, out) {
        const src = loop(ac, noiseBuffer(ac, 'brown'));
        const g = ac.createGain(); g.gain.value = 0.9;
        src.connect(g).connect(out);
        src.start();
        return [src];
    },
    // Desk fan: low, even hum.
    fan(ac, out) {
        const src = loop(ac, noiseBuffer(ac, 'pink'));
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
        const g = ac.createGain(); g.gain.value = 1.4;
        src.connect(lp).connect(g).connect(out);
        src.start();
        return [src];
    },
};

export const SOUNDS = [
    { id: 'rain', label: 'Rain on the window' },
    { id: 'brown', label: 'Brown noise' },
    { id: 'fan', label: 'Desk fan' },
];

export const playSound = (id) => {
    stopSound();
    const ac = getCtx();
    if (!ac || !builders[id]) return;
    const fade = ac.createGain();
    fade.gain.setValueAtTime(0, ac.currentTime);
    fade.gain.linearRampToValueAtTime(1, ac.currentTime + 1.2);
    fade.connect(master);
    current = { id, fade, nodes: builders[id](ac, fade) };
};

export const stopSound = () => {
    if (!current || !ctx) return;
    const { fade, nodes } = current;
    fade.gain.cancelScheduledValues(ctx.currentTime);
    fade.gain.setValueAtTime(fade.gain.value, ctx.currentTime);
    fade.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 450);
    current = null;
};

export const setVolume = (v) => {
    getCtx();
    if (master) master.gain.value = v;
};

/** Two soft bell tones, like a desk timer going off. */
export const playChime = () => {
    const ac = getCtx();
    if (!ac) return;
    [0, 0.28].forEach((offset, i) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 1318.5;
        const t = ac.currentTime + offset;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        osc.connect(g).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 1.5);
    });
};
