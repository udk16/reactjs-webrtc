import logo from './logo.svg';
import './App.css';
import { io } from "socket.io-client";
import { useEffect, useRef, useState } from 'react';
//socket initilization
const socket = io("http://localhost:3456");

function App() {

  //configuration
  const [config, setConfig] = useState({ 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] });
  //create peer object
  const [peer, setPeer] = useState(new RTCPeerConnection(config));
  //localDescp
  const [lclStream, setLclStream] = useState();
  //room id
  const [roomID, setRoomID] = useState('54378');
  //friend SocketID
  // const [friendID, setFriendID] = useState('');
  let { current: friendID } = useRef();
  //my SocketID
  // const [myID, setMyID] = useState('');
  let { current: myID } = useRef();
  //isoffer create or not
  const [isOffer, setIsOffer] = useState(false);

  //get mediaDevices
  const mediaDevs = async () => {
    const mediadevices = await navigator.mediaDevices.enumerateDevices()
    console.log("available media Devices ", mediadevices);
  }

  //get localStream
  const localStrm = async () => {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    console.log("******** stream url ");
    const videoElement = document.querySelector("video#localVideo")
    setLclStream(media);
    videoElement.srcObject = media;
    return media;
  }

  useEffect(() => {
    //check weather peer connection object create or not
    console.log(peer);

    //peerConnection();

    //socket connection
    socket.on('connect', () => {
      // console.log("socet",socket.id);
      //set the my socketID
      // setMyID(socket.id);
      myID = socket.id;
      console.log("**************** my socketId ", myID)
    })

    //friends in the room
    //incoming data is {noOfClients,friend}
    //chnaged the position of createoffer & peerconnection
    //i.e., first offer then peerconnection
    socket.on("friends", async (friends) => {
      console.log("friends ", friends)
      //2 sockets present in the room
      if (friends.noOfClients >= 2) {
        //set friend socketID
        // setFriendID(friends.friend);
        friendID = friends.friend;
        //make isoffer to true
        setIsOffer(true);
        //create offer and send to another client
        //formate to send {from,to,sdp}
        await createOffer()
        alert("client " + socket.id + " is calling")

        await peerConnection();
        // console.log("ready to create and send offer");
      }
    })

    //if we receive offer from another client through server
    socket.on("offer", async (offer) => {
      console.log(`offer from Another client **** ${JSON.stringify(offer)}`);

      //if we recevie the offer send the answer to the another client
      //1.call setRemoteDescription
      await peer.setRemoteDescription(offer.sdp);
      alert("remote description")
      console.log(`remoteDescription ${JSON.stringify(peer.remoteDescription)}`);
      //2.create answer and send it to the server
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      alert("local description")
      console.log(`local Description answer ${JSON.stringify(peer.localDescription)}`);

      //send answer formate {from,to,sdp(answer)}
      let objFormate = { from: myID, to: offer.from, sdp: peer.localDescription }
      console.log("******* answer formate to send to client", objFormate)
      // //send the answer to another client through server
      // socket.emit('answer', peer.localDescription);
      socket.emit('answer', objFormate);
    })

    //if we receive answer from another client through server
    socket.on("answer", async (remoteAnswer) => {
      console.log(`answer from Another client  ${JSON.stringify(remoteAnswer)}`);
      myID = remoteAnswer.to;
      friendID = remoteAnswer.from;
      console.log("******** myID ", myID, " friend id ***** ", friendID);

      //now call remote description
      // await peer.setRemoteDescription(remoteAnswer);
      await peer.setRemoteDescription(remoteAnswer.sdp);
    })

    //if we receive iceCandidate from another client through server
    socket.on("iceCandidate", async (iceCand) => {
      console.log(`iceCandidate from client  ${JSON.stringify(iceCand)}`);
      console.log("**** ice Candidate from another client ", iceCand.candidate);

      //add icecandidate to the local
      //await peer.addIceCandidate(iceCand);
      await peer.addIceCandidate(iceCand.candidate);
    })

    //bring out this function from inside peerconnection
    // i placed that temply here
    const localStream = localStrm()
    /* console.log("localstream ",localStream) */
    //if (localStream) {
    //add the track, to transmitted to another client
    localStream.then((stream) => {
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      })
    })

    //bring out from the peerconnection function

    //temp placed remote track
    peer.ontrack = (event) => {
      const videoElement = document.querySelector("video#remoteVideo");

      console.log(`Remote Stream *** ${JSON.stringify(event.streams[0])}`)
      if (event.streams[0]) {
        videoElement.srcObject = event.streams[0];
        console.log("********** remote streams ", event.streams[0])
        //alert("hi")
      }
      else {
        alert("no remote")
      }
    };

  }, []);

  //create offer
  const createOffer = async () => {
    //create offer
    const offer = await peer.createOffer();
    console.log("offer created ", offer);
    //setLocalDescription
    await peer.setLocalDescription(offer)
    console.log("local description offer", peer.localDescription);
    //formate the data to send to peer
    //formate should be {from,to,sdp}
    let objFormate = { from: myID, to: friendID, sdp: peer.localDescription };
    // console.log("*************** ",objFormate);
    //send the offer to another client through server
    // socket.emit("offer", peer.localDescription);
    socket.emit("offer", objFormate); alert("localDescription is sent to other")
  }

  //create peer
  const peerConnection = async () => {
    //send our local IceCandidate to server
    peer.onicecandidate = async (event) => {
      console.log("********* candidate ", event.candidate, " **** ", myID, " ****** friendID ", friendID);
      //send Data formate
      let objFormate = { from: myID, to: friendID, candidate: event.candidate };
      if (event.candidate) {
        //send to another peer
        //socket.emit("iceCandidate", event.candidate);
        console.log(" ******** my iceCandidate ", objFormate);
        socket.emit("iceCandidate", objFormate);
      }
    }

    //if iceCandidate error occur
    peer.onicecandidateerror = (event) => {
      //701 errors that indicate that candidates couldn't reach the STUN or TURN server.
      if (event.errorCode === 701) {
        console.log(`error occur iceCandidate ${JSON.stringify(event.errorText)}`)
      }
    }

    //negoation needed
    peer.onnegotiationneeded = async () => {
      //if 2 clients present then create offer
      if (isOffer) {
        //create the offer and send to another client
        await createOffer();
        alert("2 clients present")
      }
    }

    //get the remote stream 
    /*  peer.ontrack = (event) => {
        const videoElement = document.querySelector("video#remoteVideo");
  
        console.log(`Remote Stream *** ${JSON.stringify(event.streams[0])}`)
        if(event.streams[0])
        {
          videoElement.srcObject = event.streams[0];
          console.log("********** remote streams ",event.streams[0])
          //alert("hi")
        }
        else{
          alert("no remote")
        }
      };*/ //temp removed

    //add localStream
    // const localStream = await localStrm() //i removed temply
    /* console.log("localstream ",localStream) */
    /* if (localStream) {
       //add the track, to transmitted to another client
       localStream.getTracks().forEach((track) => {
         peer.addTrack(track, localStream);
       })
     }*/ //i removed temply
  }//peerconnection close

  const roomJoin = () => {
    socket.emit('roomJoin', roomID);
  }

  return (
    <div className="App">
      <header className="App-header">
        {myID && <h1>My SocketID : <h3>{myID}</h3></h1>}
        {friendID && <h1>friend SocketID : <h3>{friendID}</h3></h1>}
        {/* <button onClick={createOffer}>client to send server</button> */}
        <button onClick={roomJoin}>join Room</button>
        <input placeholder='enter room ID' onChange={(e) => { setRoomID(e.target.value) }} />
        <h1>Local</h1>
        <video id="localVideo" autoplay playsinline controls={true} />
        <h1>Remote peer</h1>
        <video id="remoteVideo" autoplay playsinline controls={true} />
      </header>

    </div>
  );
}

export default App;
