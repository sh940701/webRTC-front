import {useCallback, useEffect, useRef, useState} from "react";
import {io, Socket} from "socket.io-client";

const VideoCall = () => {
    const [roomName, setRoomName] = useState("");
    const [joined, setJoined] = useState(false);
    const socketRef = useRef<Socket>();
    const myVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection>();

    const getMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            if (myVideoRef.current) {
                myVideoRef.current.srcObject = stream;
            }
            if (!(pcRef.current && socketRef.current)) {
                return;
            }

            stream.getTracks().forEach((track) => {
                if (!pcRef.current) {
                    return;
                }
                pcRef.current.addTrack(track, stream);
            });

            pcRef.current.onicecandidate = (e) => {
                console.log(e.candidate)
                if (e.candidate) {
                    if (!socketRef.current) {
                        return;
                    }
                    console.log("recv candidate");
                    socketRef.current.emit("candidate", e.candidate, roomName);
                }
            };

            pcRef.current.ontrack = (e) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = e.streams[0];
                }
            };
        } catch (e) {
            console.error(e);
        }
    }, [roomName]);

    const createOffer = useCallback(async () => {
        console.log("create Offer");
        if (!(pcRef.current && socketRef.current)) {
            return;
        }
        try {
            const sdp = await pcRef.current.createOffer();
            pcRef.current.setLocalDescription(sdp);
            console.log("sent the offer");
            socketRef.current.emit("offer", sdp, roomName);
        } catch (e) {
            console.error(e);
        }
    }, [roomName]);

    const createAnswer = useCallback(async (sdp: RTCSessionDescription) => {
        console.log("createAnswer");
        if (!(pcRef.current && socketRef.current)) {
            return;
        }

        try {
            await pcRef.current.setRemoteDescription(sdp);
            const answerSdp = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answerSdp);

            console.log("sent the answer");
            socketRef.current.emit("answer", answerSdp, roomName);
        } catch (e) {
            console.error(e);
        }
    }, [roomName]);

    useEffect(() => {
        if (!joined) return;

        socketRef.current = io("http://43.202.43.189:8080");

        pcRef.current = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
            ],
        });

        socketRef.current.on("all_users", (allUsers: Array<{ id: string }>) => {
            if (allUsers.length > 0) {
                console.log("allUsers:", allUsers);
                createOffer();
            }
        });

        socketRef.current.on("getOffer", (sdp: RTCSessionDescription) => {
            console.log("recv Offer");
            createAnswer(sdp);
        });

        socketRef.current.on("getAnswer", (sdp: RTCSessionDescription) => {
            console.log("recv Answer");
            if (!pcRef.current) {
                return;
            }
            pcRef.current.setRemoteDescription(sdp);
        });

        socketRef.current.on("getCandidate", async (candidate: RTCIceCandidate) => {
            if (!pcRef.current) {
                return;
            }

            const data = await pcRef.current.addIceCandidate(candidate);

            console.log({data})
        });

        socketRef.current.emit("join_room", {
            room: roomName,
        });

        getMedia();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (pcRef.current) {
                pcRef.current.close();
            }
        };
    }, [joined, createOffer, createAnswer, getMedia, roomName]);

    const handleJoinRoom = () => {
        if (roomName) {
            setJoined(true);
        }
    };

    return (
        <div>
            {!joined ? (
                <div>
                    <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Enter room name"
                    />
                    <button onClick={handleJoinRoom}>Join Room</button>
                </div>
            ) : (
                <div>
                    <video
                        id="myvideo"
                        style={{
                            width: 260,
                            height: 260,
                            backgroundColor: "black",
                        }}
                        ref={myVideoRef}
                        autoPlay
                        muted
                    />
                    <video
                        id="remotevideo"
                        style={{
                            width: 240,
                            height: 240,
                            backgroundColor: "black",
                        }}
                        ref={remoteVideoRef}
                        autoPlay
                    />
                </div>
            )}
        </div>
    );
};

export default VideoCall;
