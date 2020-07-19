import React from 'react';
import Board from './Board';
import Swal from "sweetalert2";
import questionsList from './questions.json';

class Game extends React.Component {
  constructor(props) {
    super(props);

    this.userIndex = this.props.players.indexOf(this.props.name);
    this.targetIndex = this.userIndex + 1;
    if (this.targetIndex >= this.props.players.length) {
      this.targetIndex = 0;
    }
    var target = this.props.players[this.targetIndex];

    // create multidimensional arrays this way for an annoying reason
    var rows = this.props.occupants; //players
    var cols = this.props.occupants - 1; //answer blanks
    var answers = [];
    var answerers = [];

    for (let i = 0; i < rows; i++) {
      var answerBlanks = [];
      var answererBlanks = [];
      for (let j = 0; j < cols; j++) {
        answerBlanks.push("");
        answererBlanks.push("");
      }
      answers.push(answerBlanks);
      answerers.push(answererBlanks);
    }

    var questions = [];
    var shuffledQuestionsList = [];
    if (this.props.isRoomCreator) {
      shuffledQuestionsList = this.shuffleQuestionsList();
      questions = shuffledQuestionsList.slice(0, this.props.occupants - 1);
      console.log("questions getting published");
      this.props.pubnub.publish({
        message: {
          questionsList: shuffledQuestionsList,
          questions: questions,
        },
        channel: this.props.gameChannel
      });
    }

    this.state = {
      target: target,

      scores: Array(this.props.occupants).fill(0),
      backlog: Array(this.props.occupants).fill(1),

      questionsList: shuffledQuestionsList,
      questions: questions,
      answers: answers, // [player][answer]
      answerers: answerers,

      roundDone: false,
      judgeMode: false,
    };

    this.judgeCount = 0;
    this.gameOver = false;
  }

  componentDidMount() {
    this.props.pubnub.getMessage(this.props.gameChannel, (msg) => {
      console.log("message received!");
      if (msg.message.questions) {
        this.setState({
          questionsList: msg.message.questionsList,
          questions: msg.message.questions,
        },
          () => { console.log("questions were updated"); });
      }

      // Publish move to the opponent's board
      else if (msg.message.judge) {
        this.setState({
          scores: msg.message.scores,
          judgeMode: msg.message.judge === this.props.players[this.userIndex] ? false : this.state.judgeMode,
        });

        this.judgeCount++;
        if (this.judgeCount === this.props.occupants) {
          this.newRound();
        }
      }

      else if (!msg.message.reset) {
        this.publishMove(msg.message.answers, msg.message.answerers, msg.message.backlog, msg.message.judgeMode);
      }

      // Start a new game
      else if (msg.message.reset) {
        this.userIndex = this.props.players.indexOf(this.props.name);
        this.targetIndex = this.userIndex + 1;
        if (this.targetIndex >= this.props.players.length) {
          this.targetIndex = 0;
        }
        var target = this.props.players[this.targetIndex];

        this.setState({
          target: target,

          scores: Array(this.props.occupants).fill(0),
          backlog: Array(this.props.occupants).fill(1),

          questions: Array(this.props.occupants - 1).fill("q"),
          answers: Array(this.props.occupants).fill(Array(this.props.occupants - 1).fill("")), // [player][answer]
          answerers: Array(this.props.occupants).fill(Array(this.props.occupants - 1).fill("")),

          roundDone: false,
          judgeMode: false,
        });

        this.gameOver = false;
      }

      // End the game and go back to the lobby
      else if (msg.message.endGame) {
        Swal.close();
        this.props.endGame();
      }
    });
  }

  shuffleQuestionsList() {
    var shuffledQuestionsList = [...questionsList];
    for (let i = shuffledQuestionsList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * i)
      const temp = shuffledQuestionsList[i]
      shuffledQuestionsList[i] = shuffledQuestionsList[j]
      shuffledQuestionsList[j] = temp
    }
    return shuffledQuestionsList;
  }

  nextTarget() { // !!! only use if you want to continue onMakeMove2 !!!
    var oldTargetIndex = this.targetIndex;
    // update target
    this.targetIndex++;
    if (this.targetIndex >= this.props.players.length) {
      this.targetIndex = 0;
    }
    var target = this.props.players[this.targetIndex];

    //update backlog (prev person+1, current person-1)
    var backlog = this.state.backlog;
    backlog[this.userIndex] = backlog[this.userIndex] - 1;
    var prevIndex = this.userIndex - 1;
    if (prevIndex < 0) {
      prevIndex = this.props.players.length - 1;
    }
    if (oldTargetIndex !== prevIndex) { // dont add to prev person's backlog if they're getting their own back
      backlog[prevIndex] = backlog[prevIndex] + 1;
    }

    var roundDone = false;
    if (this.targetIndex === this.userIndex) {
      roundDone = true;
    }

    var judgeMode = false;
    if (backlog.every(item => item === 0)) {
      judgeMode = true;
    }

    this.setState({
      target: target,
      backlog: backlog,
      roundDone: roundDone,
      judgeMode: judgeMode,
    },
      () => { console.log("setState completed", this.state); this.onMakeMove2(); });
  }

  newRound() { // reset everything except questionsList and scores
    this.userIndex = this.props.players.indexOf(this.props.name);
    this.targetIndex = this.userIndex + 1;
    if (this.targetIndex >= this.props.players.length) {
      this.targetIndex = 0;
    }
    var target = this.props.players[this.targetIndex];

    // create multidimensional arrays this way for an annoying reason
    var rows = this.props.occupants; //players
    var cols = this.props.occupants - 1; //answer blanks
    var answers = [];
    var answerers = [];

    for (let i = 0; i < rows; i++) {
      var answerBlanks = [];
      var answererBlanks = [];
      for (let j = 0; j < cols; j++) {
        answerBlanks.push("");
        answererBlanks.push("");
      }
      answers.push(answerBlanks);
      answerers.push(answererBlanks);
    }

    var i = this.state.questionsList.indexOf(this.state.questions[this.state.questions.length - 1]);
    var questions = this.state.questionsList.slice(i + 1, i + this.props.occupants);

    this.setState({
      target: target,
      backlog: Array(this.props.occupants).fill(1),
      questions: questions,
      answers: answers, // [player][answer]
      answerers: answerers,
      roundDone: false,
      judgeMode: false,
    });

    this.judgeCount = 0;
  }

  // checkForWinner() {
  //   const winnerIndex = this.state.scores.findIndex(score => score >= 10);
  //   if (winnerIndex >= 0) {
  //     this.gameOver = true;
  //     this.newRound(this.props.players[winnerIndex]);
  //     // change state in order to rerender ?
  //   }
  // };

  // Opponent's move is published to the board
  publishMove = (updatedAnswers, updatedAnswerers, backlog, judgeMode) => {
    this.setState({
      answers: updatedAnswers,
      answerers: updatedAnswerers,
      backlog: backlog,
      judgeMode: this.state.judgeMode || judgeMode,
    });

    // this.checkForWinner()
  }

  onMakeMove = (index, answer) => {
    var answers = this.state.answers;
    var answerers = this.state.answerers;
    var backlog = this.state.backlog;
    var targetIndex = this.targetIndex;

    // Check if user has backlog field is empty
    if (backlog[this.userIndex] > 0 && !answers[targetIndex][index]) {
      answers[targetIndex][index] = (answer === "") ? "no answer" : answer;
      answerers[targetIndex][index] = this.props.name;
      this.setState({
        answers: answers,
        answerers: answerers
      });
      this.nextTarget();
      // continued in onMakeMove2()
    }
  }

  onMakeMove2() { //continuation of onMakeMove after setState finishes in nextTarget()
    // Publish move to the channel
    this.props.pubnub.publish({
      message: {
        answers: this.state.answers,
        answerers: this.state.answerers,
        backlog: this.state.backlog,
        judgeMode: this.state.judgeMode,
      },
      channel: this.props.gameChannel
    });
  }

  onGuess = (index, guess) => {
    var scores = this.state.scores;
    var answerer = this.state.answerers[this.userIndex][index];
    var answererIndex = this.props.players.indexOf(answerer);
    // increment answerer's score
    scores[answererIndex] = scores[answererIndex] + 1;

    // increment user's score if guess matches answerer
    if (answerer === guess) {
      scores[this.userIndex] = scores[this.userIndex] + 1;
    }

    // Publish move to the channel
    this.props.pubnub.publish({
      message: {
        judge: this.props.players[this.userIndex],
        scores: scores,
      },
      channel: this.props.gameChannel
    });

    // Check if there is a winner
    // this.checkForWinner()
  }

  render() {
    return (
      <div>
        <div>
          <p style={{ display: "inline", fontSize: "36px" }}>{this.props.name}</p>&nbsp;&nbsp;&nbsp;&nbsp;
          <p style={{ display: "inline" }}>Score: {this.state.scores[this.userIndex]}</p>
          <p>Backlog: {this.state.backlog[this.userIndex]}</p>
        </div>
        {!this.state.judgeMode &&
          <div className="board">
            <p style={{ fontSize: "30px", color: "LightCoral" }}>Target: {this.state.target}</p>
            {(this.state.backlog[this.userIndex] !== 0 || this.state.roundDone) &&
              <Board
                roundDone={this.state.roundDone}
                blanks={this.props.occupants - 1}
                questions={this.state.questions}
                answers={this.state.answers[this.targetIndex]}
                onClick={(index, answer) => this.onMakeMove(index, answer)}
                judgeMode={this.state.judgeMode}
                players={this.props.players}
              />
            }
            {this.state.backlog[this.userIndex] === 0 && !this.state.roundDone &&
              <p>waiting...</p>
            }
          </div>
        }
        {this.state.judgeMode &&
          <div className="board">
            <p style={{ fontSize: "30px", color: "LightCoral" }}>Target: {this.state.target}</p>
            <Board
              roundDone={false}
              blanks={this.props.occupants - 1}
              questions={this.state.questions}
              answers={this.state.answers[this.targetIndex]}
              onClick={(index, guess) => this.onGuess(index, guess)}
              judgeMode={this.state.judgeMode}
              players={this.props.players}
            />
          </div>
        }
      </div>
    );
  }
}

export default Game;
