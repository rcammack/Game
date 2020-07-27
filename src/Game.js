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
    var rows = this.props.occupants; //num of players
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
    this.players = this.props.players;
  }

  componentDidMount() {
    this.props.pubnub.getMessage(this.props.gameChannel, (msg) => {
      // set questions
      if (msg.message.questions) {
        this.setState({
          questionsList: msg.message.questionsList,
          questions: msg.message.questions,
        });
      }

      // update scores / done judging? / new round?
      else if (msg.message.judge) {
        this.setState((state) => {
          var scores = state.scores;
          scores[msg.message.answererIndex] = scores[msg.message.answererIndex] + 1;
          if (msg.message.correctGuess) {
            scores[msg.message.user] = scores[msg.message.user] + 1;
          }
          return {
            scores: scores,
            judgeMode: msg.message.judge === this.players[this.userIndex] ? false : state.judgeMode
          };
        });

        this.judgeCount++;
        if (this.judgeCount === this.props.occupants) {
          this.newRound();
        }
      }

      // someone 'made move' aka answered a question
      else if (!msg.message.reset && msg.message.name) {
        this.setState((state) => {
          var backlog = state.backlog;
          var answers = state.answers;
          var answerers = state.answerers;
          answers[msg.message.oldTargetIndex][msg.message.index] = (msg.message.answer === "") ? "no answer" : msg.message.answer;
          answerers[msg.message.oldTargetIndex][msg.message.index] = msg.message.name;

          //update backlog (prev person+1, current person-1)
          backlog[msg.message.userIndex] = backlog[msg.message.userIndex] - 1;
          var prevIndex = msg.message.userIndex - 1;
          if (prevIndex < 0) {
            prevIndex = this.players.length - 1;
          }
          if (msg.message.oldTargetIndex !== prevIndex) { // dont add to prev person's backlog if they're getting their own back
            backlog[prevIndex] = backlog[prevIndex] + 1;
          }

          var judgeMode = false;
          if (backlog.every(item => item === 0)) {
            judgeMode = true;
          }

          return {
            answers: answers,
            answerers: answerers,
            backlog: backlog,
            judgeMode: state.judgeMode || judgeMode
          };
        });
      }

      // Start a new game
      else if (msg.message.reset) {
        this.userIndex = this.players.indexOf(this.props.name);
        this.targetIndex = this.userIndex + 1;
        if (this.targetIndex >= this.players.length) {
          this.targetIndex = 0;
        }
        var target = this.players[this.targetIndex];

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

  onMakeMove = (index, answer) => {
    // Check if user has backlog & field is empty
    if (this.state.backlog[this.userIndex] > 0 && !this.state.answers[this.targetIndex][index]) {
      //next target
      var oldTargetIndex = this.targetIndex;
      // update target
      this.targetIndex++;
      if (this.targetIndex >= this.players.length) {
        this.targetIndex = 0;
      }
      var target = this.players[this.targetIndex];
      var roundDone = false;
      if (this.targetIndex === this.userIndex) {
        roundDone = true;
      }
      this.setState({
        target: target,
        roundDone: roundDone,
      });

      this.props.pubnub.publish({
        message: {
          oldTargetIndex: oldTargetIndex,
          index: index,
          answer: answer,
          name: this.props.name,
          userIndex: this.userIndex,
        },
        channel: this.props.gameChannel
      });
    }
  }

  onGuess = (index, guess) => {
    var answerer = this.state.answerers[this.userIndex][index];
    var answererIndex = this.players.indexOf(answerer);

    var correctGuess = false;
    if (answerer === guess) {
      correctGuess = true;
    }

    // Publish move to the channel
    this.props.pubnub.publish({
      message: {
        judge: this.players[this.userIndex],
        user: this.userIndex,
        answererIndex: answererIndex,
        correctGuess: correctGuess
      },
      channel: this.props.gameChannel
    });

    // Check if there is a winner
    // this.checkForWinner()
  }

  // checkForWinner() {
  //   const winnerIndex = this.state.scores.findIndex(score => score >= 10);
  //   if (winnerIndex >= 0) {
  //     this.gameOver = true;
  //     this.newRound(this.players[winnerIndex]);
  //     // change state in order to rerender ?
  //   }
  // };

  newRound() { // reset everything except questionsList, reverse players/scores & update user index
    this.players = this.players.reverse();
    this.userIndex = this.players.indexOf(this.props.name);
    this.targetIndex = this.userIndex + 1;
    if (this.targetIndex >= this.players.length) {
      this.targetIndex = 0;
    }
    var target = this.players[this.targetIndex];

    // create multidimensional arrays this way for an annoying reason
    var rows = this.props.occupants; //number of players
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

    this.setState((state) => { //set state this way because of scores relying on state.scores
      return {
        target: target,
        scores: state.scores.reverse(),
        backlog: Array(this.props.occupants).fill(1),
        questions: questions,
        answers: answers, // [player][answer]
        answerers: answerers,
        roundDone: false,
        judgeMode: false,
      };
    });

    this.judgeCount = 0;
  }


  render() {
    return (
      <div>
        <div>
          <p style={{ display: "inline", fontSize: "26px" }}>{this.props.name}</p>&nbsp;&nbsp;&nbsp;&nbsp;
          <p style={{ display: "inline" }}>Score: {this.state.scores[this.userIndex]}</p>
          {this.state.scores[this.userIndex] >= 8 && <i className="yellow trophy icon" style={{ marginLeft: "10px" }} />}
          <p>Backlog: {this.state.backlog[this.userIndex]}</p>
        </div>
        {!this.state.judgeMode &&
          <div >
            <p style={{ fontSize: "26px", color: "Tomato", marginTop: "30px", marginBottom: "10px" }}>Target: {this.state.target}</p>
            {this.state.backlog[this.userIndex] !== 0 &&
              <Board
                roundDone={this.state.roundDone}
                blanks={this.props.occupants - 1}
                questions={this.state.questions}
                answers={this.state.answers[this.targetIndex]}
                onClick={(index, answer) => this.onMakeMove(index, answer)}
                judgeMode={this.state.judgeMode}
                players={this.players}
              />
            }
            {this.state.backlog[this.userIndex] === 0 && //includes if you're waiting for your own sheet back
              <p>waiting...</p>
            }
          </div>
        }
        {this.state.judgeMode &&
          <div >
            <p style={{ fontSize: "20px", color: "Tomato", marginTop: "30px", marginBottom: "10px" }}>Guess who wrote your fav answer</p>
            <Board
              roundDone={false}
              blanks={this.props.occupants - 1}
              questions={this.state.questions}
              answers={this.state.answers[this.targetIndex]}
              onClick={(index, guess) => this.onGuess(index, guess)}
              judgeMode={this.state.judgeMode}
              players={this.players}
            />
          </div>
        }
      </div>
    );
  }
}

export default Game;
