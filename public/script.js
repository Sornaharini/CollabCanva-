let username = "";
let canvas, test, ctx;
let x, y;
let mouseDown = false;
let dataChannel;
let remoteStream;

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
let pc = new RTCPeerConnection(servers);

var io = io.connect("https://dopewhiteboard.herokuapp.com/");

function enterWhiteboard() {
  const input = document.getElementById("username-input");
  username = input.value.trim();

  if (username === "") {
    alert("Please enter your name!");
    return;
  }

  document.getElementById("welcome-container").style.display = "none";
  document.getElementById("whiteboard-container").style.display = "block";

  document.getElementById("username-display").innerText = `User: ${username}`;

  startWhiteboard();
}

function applyEvents() {
  dataChannel.onmessage = (e) => {
    let data = JSON.parse(e.data);

    if (data.draw) {
      ctx.lineTo(data.draw.x, data.draw.y);
      ctx.stroke();
    }
    if (data.down) {
      ctx.moveTo(data.down.x, data.down.y);
    }
  };
}

async function startWhiteboard() {
  canvas = document.getElementById("canvas");
  test = document.getElementById("test");
  ctx = canvas.getContext("2d");

  canvas.width = 0.98 * window.innerWidth;
  canvas.height = window.innerHeight;

  pc.addEventListener("connectionstatechange", (event) => {
    if (pc.connectionState === "connected") {
      // connected
    }
  });

  pc.ondatachannel = (e) => {
    console.log("re data channels");
    dataChannel = e.channel;
    applyEvents();
  };

  dataChannel = pc.createDataChannel("test");

  let stream = await navigator.mediaDevices.getUserMedia({ video: true });

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  remoteStream = new MediaStream();

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  test.srcObject = remoteStream;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      io.emit("propogate", { ice: event.candidate });
    }
  };

  let offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  io.emit("propogate", {
    offer: { type: offer.type, sdp: offer.sdp },
  });

  // Drawing events
  window.onmousedown = (e) => {
    ctx.moveTo(x, y);
    if (dataChannel && dataChannel.readyState === "open") {
      dataChannel.send(JSON.stringify({ down: { x, y } }));
    }
    mouseDown = true;
  };

  window.onmouseup = () => {
    mouseDown = false;
  };

  window.onmousemove = (e) => {
    x = e.clientX;
    y = e.clientY;

    if (mouseDown) {
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify({ draw: { x, y } }));
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };
}

io.on("onpropogate", async (data) => {
  if (data.offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    let answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    io.emit("propogate", { answer });
  }
  if (data.answer) {
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  }
  if (data.ice) {
    await pc.addIceCandidate(data.ice);
  }
});
