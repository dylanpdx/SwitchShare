const connectto = /[&?]connectto=([^&]+)/.exec(location.search);
const isHosting = connectto === null;

const landing = document.getElementById('landing');
const btnGroup = document.getElementById('btnGroup');
const status = document.getElementById('status');

function goLive() {
    landing.classList.add('hidden');
    const vid = document.getElementById('switchview');
    vid.classList.add('active');
}

if (isHosting) {
    const btn = document.createElement('button');
    btn.textContent = 'Host';
    btn.onclick = () => host();
    btnGroup.appendChild(btn);
} else {
    const btn = document.createElement('button');
    btn.textContent = 'Connect';
    btn.onclick = () => join();
    btnGroup.appendChild(btn);
}

const peer = new Peer();
let myPeerId = null;
let myStream = null;
let connectedTo = null;
let sink = null;
let lastControllerTs = -1;

peer.on('error', (err) => { status.textContent = 'error: ' + err.type; });

peer.on('open', (id) => {
myPeerId = id;
if (!isHosting) return;

peer.on('connection', (conn) => {
        connectedTo = conn;
        conn.on('open', () => peer.call(conn.peer, myStream));
        conn.on('data', (data) => {
        if (data.analog && sink) sink.send({ state: data });
        });
    });
});

peer.on('call', (call) => {
    call.answer();
    call.on('stream', (stream) => {
        const vid = document.getElementById('switchview');
        vid.srcObject = stream;
        vid.play();
        goLive();
    });
});

async function host() {
    sink = new SwiCCSink();
    await sink.connect();
    try {
        myStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1920, height: 1080 } });
        status.textContent = `http://${location.host}/?connectto=${myPeerId}`;
    } catch (err) {
        status.textContent = err.message;
    }
}

async function join() {
    if (isHosting) return;
    const conn = peer.connect(connectto[1], { reliable: true });
    conn.on('open', () => {
        connectedTo = conn;
        goLive();
        conn.on('data', (data) => {
        if (data === 'callme') peer.call(connectto[1], null);
        });
    });
    conn.on('error', (err) => { status.textContent = 'failed: ' + err.type; });
}

function controllerLoop() {
    const gpads = navigator.getGamepads();
    if (gpads?.length > 0) {
        const pad = gpads[0];
        if (lastControllerTs !== pad.timestamp) {
        lastControllerTs = pad.timestamp;
        const tosend = ControllerState.fromGamepad(pad);
        if (connectedTo) connectedTo.send(tosend);
        }
    }
    requestAnimationFrame(controllerLoop);
}

if (!isHosting) controllerLoop();
