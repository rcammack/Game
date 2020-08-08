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
    this.players = this.props.players;
    this.madeMove = false;
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

      //refresh question
      if (msg.message.newIndex) {
        this.setState((state) => {
          var questionsList = state.questionsList;
          var questions = state.questions;
          //replace old index and delete the new question
          questionsList[msg.message.oldIndex] = questionsList[msg.message.newIndex];
          //remove the original new question so it's not used twice
          questionsList.splice(msg.message.newIndex, 1);
          //replace question in currently used questions
          questions[msg.message.i] = questionsList[msg.message.oldIndex];
          return {
            questionsList: questionsList,
            questions: questions
          };
        });
      }

      // update scores / done judging? / new round?
      else if (msg.message.judge) {
        this.madeMove = false; //reset madeMove here since questions visibility relies on it after submitting guess
        this.judgeCount++;
        var winners = [];

        this.setState((state) => {
          var scores = state.scores;
          scores[msg.message.answererIndex] = scores[msg.message.answererIndex] + 1;
          if (msg.message.correctGuess) {
            scores[msg.message.user] = scores[msg.message.user] + 1;
          }
          //check for winner if round is done (with updated scores)
          if (this.judgeCount === this.props.occupants) {
            var maxScore = Math.max(...scores);
            if (maxScore >= this.props.winningScore) {
              for (let i = 0; i < scores.length; i++) {
                if (scores[i] === maxScore) {
                  winners.push(this.players[i]);
                }
              }
            }
          }
          return {
            scores: scores,
            judgeMode: msg.message.judge === this.players[this.userIndex] ? false : state.judgeMode
          };
        });

        //if there is a winner
        if (winners.length !== 0) {
          this.onWin(winners);
        }
        else if (this.judgeCount === this.props.occupants) {
          this.newRound(false);
        }
      }

      // someone 'made move' aka answered a question
      else if (!msg.message.reset && msg.message.name) {
        this.madeMove = true;
        this.setState((state) => {
          var backlog = state.backlog;
          var answers = state.answers;
          var answerers = state.answerers;
          answers[msg.message.oldTargetIndex][msg.message.index] = (msg.message.answer === "") ? "no answer" : msg.message.answer;
          answerers[msg.message.oldTargetIndex][msg.message.index] = msg.message.name;

          //update backlog (prev person+1, current person-1)
          backlog[msg.message.userIndex] = backlog[msg.message.userIndex] <= 0 ? 0 : backlog[msg.message.userIndex] - 1;
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

          console.log(answers);

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
        Swal.close();
        this.newRound(true);
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

    // Publish move to the channel
    this.props.pubnub.publish({
      message: {
        judge: this.players[this.userIndex],
        user: this.userIndex,
        answererIndex: answererIndex,
        correctGuess: (answerer === guess)
      },
      channel: this.props.gameChannel
    });
  }

  newRound(restart) { // reset everything except questionsList, reverse players/scores & update user index
    this.judgeCount = 0;
    this.madeMove = false;
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

    // index of the last current question in the questionsList
    var i = this.state.questionsList.indexOf(this.state.questions[this.state.questions.length - 1]);

    var questions = [];
    // if there's enough items in questionList to make a set of questions
    if (i + this.props.occupants < this.state.questionsList.length) {
      questions = this.state.questionsList.slice(i + 1, i + this.props.occupants);
    }
    // else use the rest of the questions and go back to start of questionsList
    else {
      questions = this.state.questionsList.slice(i + 1,);
      for (let i = 0; questions.length < this.props.occupants - 1; i++) {
        questions.push(this.state.questionsList[i]);
      }
    }

    this.setState((state) => {
      return {
        target: target,
        scores: restart ? Array(this.props.occupants).fill(0) : state.scores.reverse(),
        backlog: Array(this.props.occupants).fill(1),
        questions: questions,
        answers: answers, // [player][answer]
        answerers: answerers,
        roundDone: false,
        judgeMode: false,
      };
    });
  }

  onQuestionRefresh = (i) => { // for when room creator wants to switch out a question
    // index of the question in the questionsList
    var QLIndex = this.state.questionsList.indexOf(this.state.questions[i]);
    // index of last [question] in questionsList
    var endIndex = this.state.questionsList.indexOf(this.state.questions[this.state.questions.length - 1]);
    // if the next unused index in questionsList exists (aka if we didn't go through the entire questionsList)
    if (endIndex + 1 < this.state.questionsList.length) {
      this.props.pubnub.publish({
        message: {
          i: i,
          oldIndex: QLIndex,
          newIndex: endIndex + 1,
        },
        channel: this.props.gameChannel
      });
    }
  }

  onWin = (winners) => {
    let title = (winners.length > 1) ? `Tie! Winners are ${winners.toString()}` : `${winners[0]} wins!`;
    // pop up for room creator
    if (this.props.isRoomCreator) {
      Swal.fire({
        position: 'top',
        allowOutsideClick: false,
        title: title,
        text: 'New Round?',
        showCancelButton: true,
        confirmButtonColor: 'rgb(208,33,41)',
        cancelButtonColor: '#aaa',
        cancelButtonText: 'Nope',
        confirmButtonText: 'Yea!',
        width: 275,
        customClass: {
          heightAuto: false,
          title: 'title-class',
          popup: 'popup-class',
          confirmButton: 'button-class',
          cancelButton: 'button-class'
        },
      }).then((result) => {
        // Start a new round
        if (result.value) {
          this.props.pubnub.publish({
            message: {
              reset: true
            },
            channel: this.props.gameChannel
          });
        }
        else {
          // End the game
          this.props.pubnub.publish({
            message: {
              endGame: true
            },
            channel: this.props.gameChannel
          });
        }
      })
    }

    //else if not room creator
    else {
      Swal.fire({
        position: 'top',
        allowOutsideClick: false,
        title: title,
        text: 'Waiting for a new round...',
        confirmButtonColor: 'rgb(208,33,41)',
        width: 275,
        customClass: {
          heightAuto: false,
          title: 'title-class',
          popup: 'popup-class',
          confirmButton: 'button-class',
        },
      });
    }
  }


  render() {
    return (
      <div>
        <div>
          <p style={{ display: "inline", fontSize: "26px" }}>{this.props.name}</p>&nbsp;&nbsp;&nbsp;&nbsp;
          <p style={{ display: "inline" }}>Score: {this.state.scores[this.userIndex]}</p>
          {this.state.scores[this.userIndex] >= this.props.winningScore && <i className="yellow trophy icon" style={{ marginLeft: "10px" }} />}&nbsp;&nbsp;&nbsp;&nbsp;
          <p style={{ display: "inline" }}>Backlog: {this.state.backlog[this.userIndex]}</p>
        </div>
        {!this.state.judgeMode &&
          <div >
            <p style={{ fontSize: "20px", color: "Tomato", marginTop: "15px", marginBottom: "10px" }}>Target: {this.state.target}</p>
            {(this.state.backlog[this.userIndex] !== 0 || !this.madeMove) && 
              <Board
                roundDone={this.state.roundDone}
                blanks={this.props.occupants - 1}
                questions={this.state.questions}
                answers={this.state.answers[this.targetIndex]}
                onClick={(index, answer) => this.onMakeMove(index, answer)}
                judgeMode={this.state.judgeMode}
                players={this.players}
                onQuestionRefresh={(i) => this.onQuestionRefresh(i)}
                refresh={this.props.isRoomCreator && !this.madeMove}
              />
            }
            {this.state.backlog[this.userIndex] === 0 && this.madeMove && //includes if you're waiting for your own sheet back
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
              refresh={false}
            />
          </div>
        }
      </div>
    );
  }
}

export default Game;
