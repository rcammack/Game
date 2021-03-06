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
      startIsDisabled: true,
      gameChannel: null,
      winningScore: 8,
    };

    this.occupants = 0;
    this.lobbyChannel = null;
    this.roomId = null;
    this.loading = false;
    this.pubnub.init(this);

    this.pubnub.addListener({
      message: function (msg) {
        console.log("listener: message in ", msg.channel, msg.message);
      }
    })
  }

  componentDidUpdate() {
    if (this.lobbyChannel != null) {
      this.pubnub.getMessage(this.lobbyChannel, (msg) => {

        // someone joined the lobby
        if (msg.message.name != null && this.state.isRoomCreator && !this.state.isPlaying) {
          if (!this.state.players.includes(msg.message.name)) {
            if (this.occupants <= 10) {
              this.occupants++;
              var startIsDisabled = true;
              if (this.occupants > 2) {
                startIsDisabled = false;
              }
              this.setState((state) => {
                var players = state.players;
                players.push(msg.message.name);
                return {
                  startIsDisabled: startIsDisabled,
                  players: players
                };
              })
            }
          }
        }

        //start game
        if (msg.message.start && msg.message.occupants >= 3 && msg.message.occupants <= 10) {
          if (msg.message.players.includes(this.state.name)) {
            this.occupants = msg.message.occupants;
            this.pubnub.subscribe({
              channels: [msg.message.gameChannel],
              withPresence: true,
            });
            this.setState({
              players: msg.message.players,
              gameChannel: msg.message.gameChannel,
              winningScore: msg.message.winningScore,
            })
          } else {
            this.pubnub.unsubscribe({
              channels: [this.lobbyChannel]
            });
          }
        }

        //check removed player
        if (msg.message.removedPlayer) {
          if (msg.message.removedPlayer === this.state.name) {
            this.pubnub.unsubscribe({
              channels: [this.lobbyChannel]
            });

            this.lobbyChannel = null;
            this.roomId = null;

            this.setState({
              name: "",
              gameChannel: null,
            });
          }
        }
      });
    }

    //joined the game
    if (this.state.gameChannel != null) {
      this.pubnub.getPresence(this.state.gameChannel, presence => {
        if (presence.action === "join") {
          this.loading = false;
          this.setState({
            isPlaying: true,
          });
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
  onCreate = (e) => {
    // Create a random name for the channel
    this.roomId = shortid.generate().substring(0, 5);
    this.lobbyChannel = 'tictactoelobby--' + this.roomId;
    this.occupants = 1;
    this.pubnub.subscribe({
      channels: [this.lobbyChannel],
      withPresence: true
    });

    //get name
    Swal.fire({
      position: 'top',
      input: 'text',
      inputValue: window.localStorage.getItem('player') ?? "",
      allowOutsideClick: false,
      title: 'Enter your name',
      showCancelButton: true,
      confirmButtonColor: 'rgb(208,33,41)',
      confirmButtonText: 'OK',
      width: 275,
      padding: '0.7em',
      customClass: {
        heightAuto: true,
        widthAuto: true,
      }
    }).then((result) => {
      // Check if the user typed a value in the input field
      if (result.value) {
        var players = [];
        players.push(result.value);
        window.localStorage.setItem('player', result.value);

        this.setState({
          name: result.value,
          players: players,
          isRoomCreator: true,
        })
      } else {
        this.pubnub.unsubscribe({
          channels: [this.lobbyChannel]
        });
        this.roomId = null;
        this.lobbyChannel = null;
        this.occupants = 0;
      }
    })
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
        heightAuto: true,
        widthAuto: true,
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
      title: 'Enter your name',
      inputValue: window.localStorage.getItem('player') ?? "",
      allowOutsideClick: false,
      inputPlaceholder: 'Enter your name',
      showCancelButton: true,
      confirmButtonColor: 'rgb(208,33,41)',
      confirmButtonText: 'OK',
      width: 275,
      padding: '0.7em',
      customClass: {
        heightAuto: true,
        widthAuto: true,
      }
    }).then((result) => {
      // Check if the user typed a value in the input field
      if (result.value) {
        window.localStorage.setItem('player', result.value);

        this.setState({
          name: result.value,
        })
        this.pubnub.publish({
          message: {
            name: result.value,
          },
          channel: this.lobbyChannel
        });
      } else {
        this.pubnub.unsubscribe({
          channels: [this.lobbyChannel]
        });
      }
    })
  }

  onPressStart = (e) => {
    // Check that the player is connected to a channel
    if (this.lobbyChannel != null) {
      this.loading = true;

      this.setState({
        startIsDisabled: true,
      });

      // Create a different channel for the game
      var gameChannel = 'tictactoegame--' + this.roomId;

      this.pubnub.publish({
        message: {
          start: true,
          occupants: this.occupants,
          players: this.state.players,
          gameChannel: gameChannel,
          winningScore: this.state.winningScore,
        },
        channel: this.lobbyChannel
      });

      // Close the modals if they are opened
      Swal.close();
    }
  }

  onPressRemove = (player) => {
    this.occupants--;
    var startIsDisabled = false;
    if (this.occupants < 3) {
      startIsDisabled = true;
    }

    this.pubnub.publish({
      message: {
        removedPlayer: player
      },
      channel: this.lobbyChannel
    });

    this.setState((state) => {
      var players = state.players;
      players.splice(state.players.indexOf(player), 1);
      return {
        startIsDisabled: startIsDisabled,
        players: players
      };
    })
  }

  // Reset everything
  endGame = () => {
    this.pubnub.unsubscribe({
      channels: [this.lobbyChannel, this.state.gameChannel]
    });

    this.occupants = 0;
    this.lobbyChannel = null;
    this.roomId = null;
    this.loading = false;

    this.setState({
      name: "",
      players: [],
      isPlaying: false,
      isRoomCreator: false,
      startIsDisabled: true,
      gameChannel: null,
      winningScore: 8,
    });
  }

  //for winning score change
  handleChange = (event) => {
    this.setState({ winningScore: event.target.value });
  }

  render() {
    return (
      <div>
        {!this.state.isPlaying &&
          <div className="lobby">
            <h1 style={{ margin: "auto", marginBottom: "30px" }}>
              <div style={{ display: "inline" }}>Truth Bomb </div>
              <i style={{ display: "inline" }} className="bomb icon"></i>
            </h1>
            {this.roomId && <p style={{ margin: "auto", marginBottom: "15px" }}>Share this room ID with your friends: {this.roomId}</p>}
            <div style={{ margin: "auto" }}>
              { // no room id yet -> create or join
                !this.roomId &&
                <div className="ui buttons">
                  <button
                    className="ui button"
                    style={{ width: "90px" }}
                    onClick={(e) => this.onCreate()}
                  > Create
                  </button>
                  <div className="or"></div>
                  <button
                    className="ui button"
                    style={{ width: "90px" }}
                    onClick={(e) => this.onPressJoin()}
                  > Join
                  </button>
                </div>
              }

              { // created game and waiting for people to join
                this.roomId && this.state.isRoomCreator &&
                <div style={{ margin: "auto", textAlign: "center" }}>
                  <label>Points to win: </label>
                  <select style={{ marginBottom: "15px" }} value={this.state.winningScore} onChange={this.handleChange}>
                    {[2, 5, 8, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <br />
                  <button
                    className="ui button"
                    style={{ marginBottom: "15px" }}
                    disabled={this.state.startIsDisabled}
                    onClick={(e) => this.onPressStart()}>
                    {this.loading && <i className="spinner loading icon" style={{ margin: "auto" }} />}
                    {!this.loading && 'Start'}
                  </button>
                  {this.state.players.map((player, i) =>
                    <div style={{ textAlign: "left" }} key={i}>
                      {player !== this.state.name && <i style={{ display: "inline" }} className="red close icon" onClick={(e) => this.onPressRemove(player)}></i>}
                      <p style={{ display: "inline" }}>{player}</p>
                    </div>
                  )}
                </div>
              }

              { // waiting for roomCreator to start
                this.roomId != null && !this.state.isRoomCreator &&
                <div>
                  <p style={{ textAlign: "center" }}>Hi, {this.state.name}!</p>
                  <p style={{ textAlign: "center" }}>waiting for room creator to start...</p>
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
            winningScore={this.state.winningScore}
          />
        }
      </div>
    );
  }
}

export default App;
