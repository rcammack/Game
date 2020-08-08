import React from 'react';
import Form from './Form';
const colors = ['#40A4DB','#33BEB8','#B2C225','#FECC30','#F9A228','#F6621F','#DB3838','#EE657A','#A363DA'];

class Board extends React.Component {

  createBoard(row) {
    const board = [];

    for (let i = 0; i < row; i++) {
      const columns = [];
      columns.push(this.renderSquare(i));
      board.push(<div key={i}>{columns}</div>);
    }

    return board;
  }

  renderSquare(i) {
    return (
      <div style={{ marginBottom: "10px"}} key={i}>
        {((this.props.answers[i] === "" && !this.props.roundDone) || this.props.judgeMode) &&
          <Form
            judgeMode={this.props.judgeMode}
            players={this.props.players}
            question={this.props.questions[i]}
            answer={this.props.answers[i]}
            onClick={(value) => this.props.onClick(i, value)}
            onQuestionRefresh={() => this.props.onQuestionRefresh(i)}
            refresh={this.props.refresh}
            color={(i >= 0 && i < colors.length) ? colors[i] : '#dddddd'} />
        }
        {((this.props.answers[i] !== "" && !this.props.judgeMode) || (this.props.roundDone && !this.props.judgeMode)) &&
          <div>
            <p style={{ display: "inline" }}>{this.props.questions[i]}:</p>&nbsp;
          <p style={{ display: "inline", color: "CornflowerBlue" }}>{this.props.answers[i]}</p>
          </div>
        }
      </div>
    );
  }

  render() {
    return <div>{this.createBoard(this.props.blanks)}</div>;
  }
}

export default Board;
