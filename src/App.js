import React, { Component } from 'react';
import Game from './Game';
import PubNubReact from 'pubnub-react';
import Swal from "sweetalert2";
import shortid from 'shortid';
import './Game.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.pubnub = new PubNubReact({
      publishKey: "pub-c-5a45de7f-2d49-4913-a215-3a91b54a312e",
      subscribeKey: "sub-c-065bec9c-9b29-11ea-8e71-f2b83ac9263d"
    });

    this.state = {
      name: "",
      players: [],
      isPlaying: false,
      isRoomCreator: false,
      createIsDisabled: false,
      startIsDisabled: true,
      gameChannel: null,
    };

    this.occupants = 0;
    this.lobbyChannel = null;
    this.roomId = null;
    this.pubnub.init(this);
  }

  componentDidUpdate() {
    if (this.lobbyChannel != null) {
      this.pubnub.getMessage(this.lobbyChannel, (msg) => {
        if (msg.message.name != null && this.state.isRoomCreator) {
          var players = this.state.players;
          players.push(msg.message.name);
          this.occupants++;
          var startIsDisabled = true;
          if (this.occupants > 1) {
            startIsDisabled = false;
          }
          this.setState({
            startIsDisabled: startIsDisabled,
            players: players
          })
        }
        if (msg.message.start && msg.message.occupants >= 2) {
          this.occupants = msg.message.occupants;
          this.pubnub.subscribe({
            channels: [msg.message.gameChannel],
          });
          this.setState({
            isPlaying: msg.message.start,
            players: msg.message.players,
            gameChannel: msg.message.gameChannel,
          })
        }
      });
    }
  }

  componentWillUnmount() {
    this.pubnub.unsubscribe({
      channels: [this.lobbyChannel, this.state.gameChannel]
    });
  }

  // Create a room channel
  onPressCreate = (e) => {
    // Create a random name for the channel
    this.roomId = shortid.generate().substring(0, 5);
    this.lobbyChannel = 'tictactoelobby--' + this.roomId;
    this.occupants++;
    this.pubnub.subscribe({
      channels: [this.lobbyChannel],
      withPresence: true
    });

    //get name
    Swal.fire({
      position: 'top',
      input: 'text',
      allowOutsideClick: false,
      inputPlaceholder: 'Enter your name',
      showCancelButton: true,
      confirmButtonColor: 'rgb(208,33,41)',
      confirmButtonText: 'OK',
      width: 275,
      padding: '0.7em',
      customClass: {
        heightAuto: false,
        popup: 'popup-class',
        confirmButton: 'join-button-class',
        cancelButton: 'join-button-class'
      }
    }).then((result) => {
      // Check if the user typed a value in the input field
      if (result.value) {
        var players = this.state.players;
        players.push(result.value);
        this.setState({
          name: result.value,
          players: players,
        })
      }
    })

    this.setState({
      isRoomCreator: true,
      createIsDisabled: true, // Disable the 'Create' button
    });
  }

  // The 'Join' button was pressed
  onPressJoin = (e) => {
    Swal.fire({
      position: 'top',
      input: 'text',
      allowOutsideClick: false,
      inputPlaceholder: 'Enter the room id',
      showCancelButton: true,
      confirmButtonColor: 'rgb(208,33,41)',
      confirmButtonText: 'OK',
      width: 275,
      padding: '0.7em',
      customClass: {
        heightAuto: false,
        popup: 'popup-class',
        confirmButton: 'join-button-class',
        cancelButton: 'join-button-class'
      }
    }).then((result) => {
      // Check if the user typed a value in the input field
      if (result.value) {
        this.joinRoom(result.value);
      }
    })
  }

  // Join a room channel
  joinRoom = (value) => {
    this.roomId = value;
    this.lobbyChannel = 'tictactoelobby--' + this.roomId;

    this.pubnub.subscribe({
      channels: [this.lobbyChannel],
      withPresence: true
    });

    //get name
    Swal.fire({
      position: 'top',
      input: 'text',
      allowOutsideClick: false,
      inputPlaceholder: 'Enter your name',
      showCancelButton: true,
      confirmButtonColor: 'rgb(208,33,41)',
      confirmButtonText: 'OK',
      width: 275,
      padding: '0.7em',
      customClass: {
        heightAuto: false,
        popup: 'popup-class',
        confirmButton: 'join-button-class',
        cancelButton: 'join-button-class'
      }
    }).then((result) => {
      // Check if the user typed a value in the input field
      if (result.value) {
        this.setState({
          name: result.value,
        })
        this.pubnub.publish({
          message: {
            name: result.value,
          },
          channel: this.lobbyChannel
        });
      }
    })
  }

  onPressStart = (e) => {
    // Check that the player is connected to a channel
    if (this.lobbyChannel != null) {
      // Create a different channel for the game
      var gameChannel = 'tictactoegame--' + this.roomId;

      this.pubnub.publish({
        message: {
          start: true,
          occupants: this.occupants,
          players: this.state.players,
          gameChannel: gameChannel
        },
        channel: this.lobbyChannel
      });

      this.pubnub.subscribe({
        channels: [gameChannel]
      });

      this.setState({
        isPlaying: true,
        gameChannel: gameChannel,
      });

      // Close the modals if they are opened
      Swal.close();
    }
  }

  // Reset everything
  endGame = () => {
    this.pubnub.unsubscribe({
      channels: [this.lobbyChannel, this.state.gameChannel]
    });

    this.setState({
      name: "",
      players: [],
      isPlaying: false,
      isRoomCreator: false,
      createIsDisabled: false,
      startIsDisabled: true,
      gameChannel: null,
    });

    this.occupants = 0;
    this.lobbyChannel = null;
    this.roomId = null;
    this.pubnub.init(this);
  }

  render() {
    return (
      <div>
        {!this.state.isPlaying &&
          <div className="lobby">
            <h1 style={{margin:"auto", marginBottom:"30px"}}>
              <div style={{ display: "inline" }} className="content">Truth Bomb </div>
              <i style={{ display: "inline" }} className="bomb icon"></i>
            </h1>
            <p style={{margin:"auto", marginBottom:"15px"}}>Share this room ID with your friends: {this.roomId}</p>
            <div style={{margin:"auto"}}>
              { // no room id yet -> create or join
                !this.roomId &&
                <div className="ui buttons">
                  <button
                    className="ui button"
                    style={{width:"90px"}}
                    disabled={this.state.createIsDisabled}
                    onClick={(e) => this.onPressCreate()}
                  > Create
                  </button>
                  <div className="or"></div>
                  <button
                    className="ui button"
                    style={{width:"90px"}}
                    onClick={(e) => this.onPressJoin()}
                  > Join
                  </button>
                </div>
              }

              { // created game and waiting for people to join
                this.roomId && this.state.isRoomCreator &&
                <div style={{margin:"auto"}}>
                  <button
                    className="ui button"
                    style={{marginBottom:"15px"}}
                    disabled={this.state.startIsDisabled}
                    onClick={(e) => this.onPressStart()}
                  > Start
                  </button>
                  {this.state.players.map((player, i) => <p style={{textAlign:"center"}} key={i}>{player}</p>)}
                </div>
              }

              { // waiting for roomCreator to start
                this.roomId != null && !this.state.isRoomCreator &&
                <div>
                  <p style={{textAlign:"center"}}>Hi, {this.state.name}!</p>
                  <p style={{textAlign:"center"}}>waiting for room creator to start...</p>
                </div>
              }
            </div>
          </div>
        }

        {this.state.isPlaying &&
          <Game
            pubnub={this.pubnub}
            gameChannel={this.state.gameChannel}
            name={this.state.name}
            players={this.state.players}
            occupants={this.occupants}
            isRoomCreator={this.state.isRoomCreator}
            endGame={this.endGame}
          />
        }
      </div>
    );
  }
}

export default App;
